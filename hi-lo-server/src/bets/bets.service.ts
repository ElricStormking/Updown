import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Bet,
  BetResult,
  BetSide,
  BetType,
  DigitBetType,
  Prisma,
  RoundStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { PlaceBetDto } from './dto/place-bet.dto';
import { DIGIT_SUM_RANGES } from '../game/digit-bet.constants';
import { DigitOutcome } from '../game/digit-bet.utils';
import {
  buildDigitBetKey,
  getBonusRatioForSlot,
  isBonusDigitBet,
  type DigitBonusSlot,
} from '../game/digit-bonus.utils';
import { GameConfigService } from '../config/game-config.service';
import type { DigitPayouts, GameConfigSnapshot } from '../config/game-config.defaults';

type SumKey = keyof DigitPayouts['sum'];

interface SlipBet {
  id: string;
  roundId: number;
  betType: BetType;
  side: BetSide | null;
  digitType: DigitBetType | null;
  selection: string | null;
  amount: Prisma.Decimal;
  odds: Prisma.Decimal;
  createdAt: Date;
}

export interface PlacedBetPayload {
  bet: SlipBet;
  walletBalance: Prisma.Decimal;
}

export interface ClearedBetsPayload {
  roundId: number;
  cleared: number;
  refundedAmount: Prisma.Decimal;
  walletBalance: Prisma.Decimal;
}

export interface SettlementStats {
  totalBets: number;
  winners: number;
  refunded: number;
  totalVolume: number;
  participants: string[];
  balanceUpdates: Array<{ userId: string; balance: number }>;
}

@Injectable()
export class BetsService {
  private readonly logger = new Logger(BetsService.name);

  private redisOk: boolean | null = null;
  private readonly slipMemory = new Map<string, BetSlipStored>();
  private readonly slipUsersMemory = new Map<number, Set<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly gameConfigService: GameConfigService,
    private readonly redis: RedisService,
  ) {}

  async placeBet(userId: string, dto: PlaceBetDto): Promise<PlacedBetPayload> {
    const round = await this.prisma.round.findUnique({
      where: { id: dto.roundId },
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }
    if (round.status !== RoundStatus.BETTING) {
      throw new BadRequestException('Betting window is closed for this round');
    }
    if (round.lockTime.getTime() <= Date.now()) {
      throw new BadRequestException('Round already locked');
    }

    const config = this.getConfigForRound(round);
    if (dto.amount < config.minBetAmount || dto.amount > config.maxBetAmount) {
      throw new BadRequestException(
        `Bet amount must be between ${config.minBetAmount} and ${config.maxBetAmount}`,
      );
    }

    const amountDecimal = new Prisma.Decimal(dto.amount);
    const betType =
      dto.betType ?? (dto.digitType ? BetType.DIGIT : BetType.HILO);
    let betSide: BetSide | null = null;
    let digitType: DigitBetType | null = null;
    let selection: string | null = null;
    let odds: Prisma.Decimal;

    if (betType === BetType.HILO) {
      if (!dto.side) {
        throw new BadRequestException('Bet side is required for Hi-Lo bets');
      }
      if (dto.digitType || dto.selection) {
        throw new BadRequestException(
          'Digit selections are not allowed for Hi-Lo bets',
        );
      }
      betSide = dto.side;
      odds =
        dto.side === BetSide.UP
          ? new Prisma.Decimal(round.oddsUp)
          : new Prisma.Decimal(round.oddsDown);
    } else {
      if (dto.side) {
        throw new BadRequestException(
          'Bet side is not allowed for digit bets',
        );
      }
      if (!dto.digitType) {
        throw new BadRequestException('Digit bet type is required');
      }
      const normalized = this.normalizeDigitBet(
        dto.digitType,
        dto.selection,
        config.digitPayouts,
      );
      digitType = normalized.digitType;
      selection = normalized.selection;
      odds = normalized.odds;
    }

    // Batch-write mode:
    // - During BETTING: store the bet in a per-user "bet slip" (Redis/memory), do NOT write Bet rows yet.
    // - At lock (RoundStatus.RESULT_PENDING): RoundEngine commits slips to Bet rows and debits wallets.

    const wallet = await this.walletService.getOrCreateWallet(userId);
    const walletBalance = new Prisma.Decimal(wallet.balance);

    const ttlMs = this.getSlipTtlMs(round.lockTime, round.endTime);
    await this.addToSlipOrThrow(
      userId,
      dto.roundId,
      {
        betType,
        side: betSide,
        digitType,
        selection,
        amount: dto.amount,
      },
      walletBalance,
      ttlMs,
    );

    // Pseudo-bet payload for client UX (slot highlighting, etc.)
    const accepted: SlipBet = {
      id: `slip:${dto.roundId}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      roundId: dto.roundId,
      betType,
      side: betSide,
      digitType,
      selection,
      amount: amountDecimal,
      odds,
      createdAt: new Date(),
    };

    return {
      bet: accepted,
      walletBalance: walletBalance,
    };
  }

  async clearBetsForRound(userId: string, roundId: number): Promise<ClearedBetsPayload> {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }
    if (round.status !== RoundStatus.BETTING) {
      throw new BadRequestException('Betting window is closed for this round');
    }
    if (round.lockTime.getTime() <= Date.now()) {
      throw new BadRequestException('Round already locked');
    }

    const cleared = await this.clearSlip(userId, roundId);
    const wallet = await this.walletService.getOrCreateWallet(userId);

    // In batch-write mode, bets aren't debited until lock, so there's nothing to "refund" here.
    return {
      roundId,
      cleared,
      refundedAmount: new Prisma.Decimal(0),
      walletBalance: new Prisma.Decimal(wallet.balance),
    };
  }

  async commitBetSlipsForRound(roundId: number) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
    });
    if (!round) {
      return;
    }
    const config = this.getConfigForRound(round);

    // Guard: only commit once per round (best-effort).
    const committedKey = this.getSlipCommittedKey(roundId);
    if (await this.hasCommittedRound(committedKey)) {
      return;
    }

    const userIds = await this.getSlipUsers(roundId);
    if (!userIds.length) {
      await this.markCommittedRound(committedKey, this.getSlipTtlMs(round.lockTime, round.endTime));
      return;
    }

    for (const userId of userIds) {
      const slip = await this.getSlip(userId, roundId);
      if (!slip) continue;

      const items = Object.values(slip.items ?? {});
      if (!items.length) {
        await this.clearSlip(userId, roundId);
        continue;
      }

      const total = items.reduce(
        (sum, item) => sum.add(new Prisma.Decimal(item.amount)),
        new Prisma.Decimal(0),
      );
      if (total.lte(0)) {
        await this.clearSlip(userId, roundId);
        continue;
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          // Create Bet rows in a batch for this user/round.
          const rows = items.map((item) => {
            if (item.betType === BetType.HILO) {
              if (!item.side) {
                throw new BadRequestException('Missing side for Hi-Lo slip item');
              }
              const odds =
                item.side === BetSide.UP
                  ? new Prisma.Decimal(round.oddsUp)
                  : new Prisma.Decimal(round.oddsDown);
              return {
                userId,
                roundId,
                betType: BetType.HILO,
                side: item.side,
                digitType: null,
                selection: null,
                amount: new Prisma.Decimal(item.amount),
                odds,
                payout: new Prisma.Decimal(0),
                result: BetResult.PENDING,
              };
            }

            if (!item.digitType) {
              throw new BadRequestException('Missing digitType for digit slip item');
            }
            const normalized = this.normalizeDigitBet(
              item.digitType,
              item.selection ?? undefined,
              config.digitPayouts,
            );
            return {
              userId,
              roundId,
              betType: BetType.DIGIT,
              side: null,
              digitType: normalized.digitType,
              selection: normalized.selection,
              amount: new Prisma.Decimal(item.amount),
              odds: normalized.odds,
              payout: new Prisma.Decimal(0),
              result: BetResult.PENDING,
            };
          });

          await tx.bet.createMany({ data: rows });
          await this.walletService.adjustBalance(userId, total.mul(-1), tx);
        });
      } catch (error) {
        // If wallet changed externally or any slip item is invalid, skip this user.
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Slip commit skipped for user ${userId} round ${roundId}: ${reason}`);
      } finally {
        // Always clear slip so it can't be committed later after lock.
        await this.clearSlip(userId, roundId);
      }
    }

    await this.clearSlipUsers(roundId);
    await this.markCommittedRound(committedKey, this.getSlipTtlMs(round.lockTime, round.endTime));
  }

  async settleRound(
    roundId: number,
    winningSide: BetSide | null,
    digitOutcome: DigitOutcome | null,
    digitBonusSlots: DigitBonusSlot[] = [],
    digitBonusFactor: number | null = null,
  ): Promise<SettlementStats> {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: { gameConfigSnapshot: true },
    });
    const config = this.gameConfigService.normalizeSnapshot(
      round?.gameConfigSnapshot,
    );
    const digitPayouts = config.digitPayouts;

    const bets = await this.prisma.bet.findMany({
      where: { roundId },
    });

    if (!bets.length) {
      return {
        totalBets: 0,
        winners: 0,
        refunded: 0,
        totalVolume: 0,
        participants: [],
        balanceUpdates: [],
      };
    }

    const participants = Array.from(new Set(bets.map((bet) => bet.userId)));

    // Check if a triple occurred and identify users who have triple bets
    const isTriple = digitOutcome?.isTriple ?? false;
    const usersWithTripleBets = new Set<string>();
    if (isTriple) {
      for (const bet of bets) {
        if (
          bet.betType === BetType.DIGIT &&
          (bet.digitType === DigitBetType.ANY_TRIPLE ||
            bet.digitType === DigitBetType.TRIPLE)
        ) {
          usersWithTripleBets.add(bet.userId);
        }
      }
    }

    let winners = 0;
    let refunded = 0;
    let totalVolume = new Prisma.Decimal(0);
    const balanceUpdates: SettlementStats['balanceUpdates'] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const bet of bets) {
        totalVolume = totalVolume.add(bet.amount);

        if (bet.betType === BetType.DIGIT) {
          if (!digitOutcome) {
            await this.processRefund(tx, bet, balanceUpdates);
            refunded += 1;
            continue;
          }
          // If triple occurred and player has no triple bets, all non-triple bets lose
          if (
            isTriple &&
            !usersWithTripleBets.has(bet.userId) &&
            bet.digitType !== DigitBetType.ANY_TRIPLE &&
            bet.digitType !== DigitBetType.TRIPLE
          ) {
            await this.markLoss(tx, bet.id);
            continue;
          }
          const payoutMultiplier = this.resolveDigitPayout(
            bet,
            digitOutcome,
            digitPayouts,
          );
          if (payoutMultiplier !== null) {
            const bonusRatio = getBonusRatioForSlot(
              bet.digitType,
              bet.selection ?? null,
              digitBonusSlots,
            );
            const isBonusSlot = isBonusDigitBet(
              bet.digitType,
              bet.selection ?? null,
              digitBonusSlots,
            );
            const factor = Number(digitBonusFactor ?? 1);
            const boosted =
              typeof bonusRatio === 'number' && Number.isFinite(bonusRatio)
                ? bonusRatio
                : isBonusSlot && factor > 1
                  ? payoutMultiplier * factor
                : payoutMultiplier;
            await this.processDigitWin(
              tx,
              bet,
              boosted,
              balanceUpdates,
            );
            winners += 1;
          } else {
            await this.markLoss(tx, bet.id);
          }
          continue;
        }

        if (!winningSide) {
          await this.processRefund(tx, bet, balanceUpdates);
          refunded += 1;
          continue;
        }

        if (bet.side === winningSide) {
          await this.processWin(tx, bet, balanceUpdates);
          winners += 1;
        } else {
          await this.markLoss(tx, bet.id);
        }
      }
    });

    if (winningSide === null && !digitOutcome) {
      this.logger.log(
        `Round ${roundId} refunded ${refunded} bets (total ${bets.length})`,
      );
    } else {
      this.logger.log(
        `Round ${roundId} settled. Winners: ${winners}/${bets.length}`,
      );
    }

    return {
      totalBets: bets.length,
      winners,
      refunded,
      totalVolume: Number(totalVolume),
      participants,
      balanceUpdates,
    };
  }

  private async processRefund(
    tx: Prisma.TransactionClient,
    bet: Bet,
    updates: SettlementStats['balanceUpdates'],
  ) {
    const wallet = await this.walletService.adjustBalance(
      bet.userId,
      bet.amount,
      tx,
    );
    updates.push({
      userId: bet.userId,
      balance: Number(wallet.balance),
    });
    await tx.bet.update({
      where: { id: bet.id },
      data: {
        result: BetResult.REFUND,
        payout: bet.amount,
      },
    });
  }

  private async processWin(
    tx: Prisma.TransactionClient,
    bet: Bet,
    updates: SettlementStats['balanceUpdates'],
  ) {
    const payout = new Prisma.Decimal(bet.amount).mul(bet.odds);
    const wallet = await this.walletService.adjustBalance(
      bet.userId,
      payout,
      tx,
    );
    updates.push({
      userId: bet.userId,
      balance: Number(wallet.balance),
    });
    await tx.bet.update({
      where: { id: bet.id },
      data: {
        result: BetResult.WIN,
        payout,
      },
    });
  }

  private async processDigitWin(
    tx: Prisma.TransactionClient,
    bet: Bet,
    payoutMultiplier: number,
    updates: SettlementStats['balanceUpdates'],
  ) {
    const payout = new Prisma.Decimal(bet.amount).mul(payoutMultiplier);
    const wallet = await this.walletService.adjustBalance(
      bet.userId,
      payout,
      tx,
    );
    updates.push({
      userId: bet.userId,
      balance: Number(wallet.balance),
    });
    await tx.bet.update({
      where: { id: bet.id },
      data: {
        result: BetResult.WIN,
        payout,
        odds: new Prisma.Decimal(payoutMultiplier),
      },
    });
  }

  private async markLoss(tx: Prisma.TransactionClient, betId: string) {
    await tx.bet.update({
      where: { id: betId },
      data: {
        result: BetResult.LOSE,
        payout: new Prisma.Decimal(0),
      },
    });
  }

  private normalizeDigitBet(
    digitType: DigitBetType,
    selection: string | undefined,
    payouts: DigitPayouts,
  ): { digitType: DigitBetType; selection: string | null; odds: Prisma.Decimal } {
    const cleanSelection = selection?.trim();
    switch (digitType) {
      case DigitBetType.SMALL:
      case DigitBetType.BIG:
      case DigitBetType.ODD:
      case DigitBetType.EVEN:
        if (cleanSelection) {
          throw new BadRequestException('Selection is not needed for this bet');
        }
        const sboePayout =
          this.getSlotPayoutOverride(digitType, null, payouts) ?? payouts.smallBigOddEven;
        return {
          digitType,
          selection: null,
          odds: new Prisma.Decimal(sboePayout),
        };
      case DigitBetType.ANY_TRIPLE:
        if (cleanSelection) {
          throw new BadRequestException('Selection is not needed for this bet');
        }
        const anyTriplePayout =
          this.getSlotPayoutOverride(digitType, null, payouts) ?? payouts.anyTriple;
        return {
          digitType,
          selection: null,
          odds: new Prisma.Decimal(anyTriplePayout),
        };
      case DigitBetType.DOUBLE: {
        const normalized = this.normalizeDoubleSelection(cleanSelection);
        const doublePayout =
          this.getSlotPayoutOverride(digitType, normalized, payouts) ?? payouts.double;
        return {
          digitType,
          selection: normalized,
          odds: new Prisma.Decimal(doublePayout),
        };
      }
      case DigitBetType.TRIPLE: {
        const normalized = this.normalizeTripleSelection(cleanSelection);
        const triplePayout =
          this.getSlotPayoutOverride(digitType, normalized, payouts) ?? payouts.triple;
        return {
          digitType,
          selection: normalized,
          odds: new Prisma.Decimal(triplePayout),
        };
      }
      case DigitBetType.SUM: {
        const normalized = this.normalizeSumSelection(cleanSelection, payouts);
        const payout = payouts.sum[normalized];
        return {
          digitType,
          selection: String(normalized),
          odds: new Prisma.Decimal(payout),
        };
      }
      case DigitBetType.SINGLE: {
        const normalized = this.normalizeSingleSelection(cleanSelection);
        const singlePayout =
          this.getSlotPayoutOverride(digitType, normalized, payouts) ?? payouts.single.single;
        return {
          digitType,
          selection: normalized,
          odds: new Prisma.Decimal(singlePayout),
        };
      }
      default:
        throw new BadRequestException('Unsupported digit bet type');
    }
  }

  private getSlotPayoutOverride(
    digitType: DigitBetType,
    selection: string | null,
    payouts: DigitPayouts,
  ): number | null {
    if (!payouts.bySlot) return null;
    const key = buildDigitBetKey(digitType, selection);
    const value = payouts.bySlot[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private scaleSinglePayout(base: number, target: number, defaultBase: number): number {
    if (!Number.isFinite(base)) return target;
    if (!Number.isFinite(defaultBase) || defaultBase <= 0) return target;
    return base * (target / defaultBase);
  }

  private normalizeDoubleSelection(selection?: string | null) {
    if (!selection) {
      throw new BadRequestException('Double selection is required');
    }
    if (!/^\d{2}$/.test(selection)) {
      throw new BadRequestException('Double selection must be two digits');
    }
    if (selection[0] !== selection[1]) {
      throw new BadRequestException('Double selection must repeat the digit');
    }
    return selection;
  }

  private normalizeTripleSelection(selection?: string | null) {
    if (!selection) {
      throw new BadRequestException('Triple selection is required');
    }
    if (!/^\d{3}$/.test(selection)) {
      throw new BadRequestException('Triple selection must be three digits');
    }
    if (selection[0] !== selection[1] || selection[1] !== selection[2]) {
      throw new BadRequestException('Triple selection must repeat the digit');
    }
    return selection;
  }

  private normalizeSumSelection(
    selection: string | null | undefined,
    payouts: DigitPayouts,
  ): SumKey {
    if (!selection) {
      throw new BadRequestException('Sum selection is required');
    }
    if (!/^\d{1,2}$/.test(selection)) {
      throw new BadRequestException('Sum selection must be a number');
    }
    const sum = Number(selection);
    if (
      sum < DIGIT_SUM_RANGES.sumMin ||
      sum > DIGIT_SUM_RANGES.sumMax
    ) {
      throw new BadRequestException('Sum selection out of range');
    }
    if (!this.isSumKey(sum, payouts.sum)) {
      throw new BadRequestException('Sum selection out of range');
    }
    return sum;
  }

  private normalizeSingleSelection(selection?: string | null) {
    if (!selection) {
      throw new BadRequestException('Single selection is required');
    }
    if (!/^\d$/.test(selection)) {
      throw new BadRequestException('Single selection must be one digit');
    }
    return selection;
  }

  private resolveDigitPayout(
    bet: Bet,
    outcome: DigitOutcome,
    payouts: DigitPayouts,
  ): number | null {
    if (!bet.digitType) {
      return null;
    }

    const sum = outcome.sum;
    const isTriple = outcome.isTriple;
    const selection = bet.selection ?? '';
    const countFor = (digit: string) => outcome.counts[digit] ?? 0;
    const slotPayout = this.getSlotPayoutOverride(
      bet.digitType,
      bet.selection ?? null,
      payouts,
    );

    switch (bet.digitType) {
      case DigitBetType.SMALL:
        return !isTriple &&
          sum >= DIGIT_SUM_RANGES.small.min &&
          sum <= DIGIT_SUM_RANGES.small.max
          ? slotPayout ?? payouts.smallBigOddEven
          : null;
      case DigitBetType.BIG:
        return !isTriple &&
          sum >= DIGIT_SUM_RANGES.big.min &&
          sum <= DIGIT_SUM_RANGES.big.max
          ? slotPayout ?? payouts.smallBigOddEven
          : null;
      case DigitBetType.ODD:
        return !isTriple && sum % 2 === 1
          ? slotPayout ?? payouts.smallBigOddEven
          : null;
      case DigitBetType.EVEN:
        return !isTriple && sum % 2 === 0
          ? slotPayout ?? payouts.smallBigOddEven
          : null;
      case DigitBetType.ANY_TRIPLE:
        return isTriple ? slotPayout ?? payouts.anyTriple : null;
      case DigitBetType.TRIPLE:
        return isTriple && selection === outcome.digits
          ? slotPayout ?? payouts.triple
          : null;
      case DigitBetType.DOUBLE: {
        const digit = selection[0];
        return digit && countFor(digit) >= 2 ? slotPayout ?? payouts.double : null;
      }
      case DigitBetType.SUM: {
        const target = Number(selection);
        if (!Number.isFinite(target) || !this.isSumKey(target, payouts.sum)) {
          return null;
        }
        return sum === target ? payouts.sum[target] : null;
      }
      case DigitBetType.SINGLE: {
        const digit = selection[0];
        if (!digit) {
          return null;
        }
        const count = countFor(digit);
        if (count === 1) {
          return slotPayout ?? payouts.single.single;
        }
        if (count === 2) {
          const base = slotPayout ?? payouts.single.single;
          return this.scaleSinglePayout(base, payouts.single.double, payouts.single.single);
        }
        if (count === 3) {
          const base = slotPayout ?? payouts.single.single;
          return this.scaleSinglePayout(base, payouts.single.triple, payouts.single.single);
        }
        return null;
      }
      default:
        return null;
    }
  }

  private async isRedisOk() {
    if (this.redisOk !== null) {
      return this.redisOk;
    }
    const probe = await this.redis.set('probe:bets-slip', '1', 1000);
    this.redisOk = probe === 'OK';
    return this.redisOk;
  }

  private getSlipKey(userId: string, roundId: number) {
    return `betslip:${roundId}:${userId}`;
  }

  private getSlipUsersKey(roundId: number) {
    return `betslip:${roundId}:users`;
  }

  private getSlipCommittedKey(roundId: number) {
    return `betslip:${roundId}:committed`;
  }

  private getSlipTtlMs(lockTime: Date, endTime: Date) {
    // Keep slips around slightly past round end to survive short processing delays.
    const ttl = endTime.getTime() - Date.now() + 60_000;
    const min = lockTime.getTime() - Date.now() + 60_000;
    return Math.max(ttl, min, 60_000);
  }

  private makeSlipItemKey(item: Omit<BetSlipItem, 'amount'>) {
    if (item.betType === BetType.HILO) {
      return `HILO|${item.side ?? ''}`;
    }
    return `DIGIT|${item.digitType ?? ''}|${item.selection ?? ''}`;
  }

  private async getSlip(userId: string, roundId: number): Promise<BetSlipStored | null> {
    const key = this.getSlipKey(userId, roundId);
    if (await this.isRedisOk()) {
      return await this.redis.getJson<BetSlipStored>(key);
    }
    return this.slipMemory.get(key) ?? null;
  }

  private async setSlip(slip: BetSlipStored, ttlMs: number) {
    const key = this.getSlipKey(slip.userId, slip.roundId);
    if (await this.isRedisOk()) {
      await this.redis.setJson(key, slip, ttlMs);
      return;
    }
    this.slipMemory.set(key, slip);
  }

  private async getSlipUsers(roundId: number) {
    const key = this.getSlipUsersKey(roundId);
    if (await this.isRedisOk()) {
      return (await this.redis.getJson<string[]>(key)) ?? [];
    }
    return Array.from(this.slipUsersMemory.get(roundId) ?? []);
  }

  private async addSlipUser(roundId: number, userId: string, ttlMs: number) {
    const key = this.getSlipUsersKey(roundId);
    if (await this.isRedisOk()) {
      const existing = (await this.redis.getJson<string[]>(key)) ?? [];
      if (!existing.includes(userId)) {
        existing.push(userId);
        await this.redis.setJson(key, existing, ttlMs);
      }
      return;
    }
    const set = this.slipUsersMemory.get(roundId) ?? new Set<string>();
    set.add(userId);
    this.slipUsersMemory.set(roundId, set);
  }

  private async clearSlipUsers(roundId: number) {
    const key = this.getSlipUsersKey(roundId);
    if (await this.isRedisOk()) {
      await this.redis.del(key);
      return;
    }
    this.slipUsersMemory.delete(roundId);
  }

  private async clearSlip(userId: string, roundId: number) {
    const key = this.getSlipKey(userId, roundId);
    const slip = await this.getSlip(userId, roundId);
    const cleared = slip ? Object.keys(slip.items ?? {}).length : 0;
    if (await this.isRedisOk()) {
      await this.redis.del(key);
      return cleared;
    }
    this.slipMemory.delete(key);
    return cleared;
  }

  private async hasCommittedRound(committedKey: string) {
    if (await this.isRedisOk()) {
      const value = await this.redis.get(committedKey);
      return value === '1';
    }
    return false;
  }

  private async markCommittedRound(committedKey: string, ttlMs: number) {
    if (await this.isRedisOk()) {
      await this.redis.set(committedKey, '1', ttlMs);
    }
  }

  private async addToSlipOrThrow(
    userId: string,
    roundId: number,
    item: BetSlipItem,
    walletBalance: Prisma.Decimal,
    ttlMs: number,
  ) {
    const existing = (await this.getSlip(userId, roundId)) ?? {
      roundId,
      userId,
      items: {},
      updatedAt: new Date().toISOString(),
    };

    const key = this.makeSlipItemKey(item);
    const nextItems = { ...(existing.items ?? {}) };
    const prev = nextItems[key];
    nextItems[key] = {
      betType: item.betType,
      side: item.side,
      digitType: item.digitType,
      selection: item.selection,
      amount: Number(prev?.amount ?? 0) + Number(item.amount),
    };

    const total = Object.values(nextItems).reduce(
      (sum, entry) => sum.add(new Prisma.Decimal(entry.amount)),
      new Prisma.Decimal(0),
    );

    if (total.gt(walletBalance)) {
      throw new BadRequestException('Insufficient balance');
    }

    const slip: BetSlipStored = {
      roundId,
      userId,
      items: nextItems,
      updatedAt: new Date().toISOString(),
    };

    await this.setSlip(slip, ttlMs);
    await this.addSlipUser(roundId, userId, ttlMs);
    return slip;
  }

  private getConfigForRound(round: { gameConfigSnapshot?: unknown | null }): GameConfigSnapshot {
    return this.gameConfigService.normalizeSnapshot(round.gameConfigSnapshot);
  }

  private isSumKey(
    value: number,
    sumTable: DigitPayouts['sum'],
  ): value is SumKey {
    return Object.prototype.hasOwnProperty.call(sumTable, value);
  }
}

type BetSlipItem = {
  betType: BetType;
  side: BetSide | null;
  digitType: DigitBetType | null;
  selection: string | null;
  amount: number;
};

type BetSlipStored = {
  roundId: number;
  userId: string;
  items: Record<string, BetSlipItem>;
  updatedAt: string;
};

