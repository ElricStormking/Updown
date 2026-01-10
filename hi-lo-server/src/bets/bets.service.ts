import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { WalletService } from '../wallet/wallet.service';
import { PlaceBetDto } from './dto/place-bet.dto';
import { AppConfig } from '../config/configuration';
import { DIGIT_PAYOUTS, DIGIT_SUM_RANGES } from '../game/digit-bet.constants';
import { DigitOutcome } from '../game/digit-bet.utils';
import { applyBonusFactor, isBonusDigitBet, type DigitBonusSlot } from '../game/digit-bonus.utils';

type SumKey = keyof typeof DIGIT_PAYOUTS.sum;

export interface PlacedBetPayload {
  bet: Bet;
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

  private readonly minBet: number;
  private readonly maxBet: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly configService: ConfigService<AppConfig>,
  ) {
    this.minBet = this.configService.getOrThrow<number>('game.minBetAmount', {
      infer: true,
    });
    this.maxBet = this.configService.getOrThrow<number>('game.maxBetAmount', {
      infer: true,
    });
  }

  async placeBet(userId: string, dto: PlaceBetDto): Promise<PlacedBetPayload> {
    if (dto.amount < this.minBet || dto.amount > this.maxBet) {
      throw new BadRequestException(
        `Bet amount must be between ${this.minBet} and ${this.maxBet}`,
      );
    }

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
      const normalized = this.normalizeDigitBet(dto.digitType, dto.selection);
      digitType = normalized.digitType;
      selection = normalized.selection;
      odds = normalized.odds;
    }

    const bet = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const balance = new Prisma.Decimal(wallet.balance);
      if (balance.lt(amountDecimal)) {
        throw new BadRequestException('Insufficient balance');
      }

      const createdBet = await tx.bet.create({
        data: {
          userId,
          roundId: dto.roundId,
          betType,
          side: betSide,
          digitType,
          selection,
          amount: amountDecimal,
          odds,
        },
      });

      const updatedWallet = await this.walletService.adjustBalance(
        userId,
        amountDecimal.mul(-1),
        tx,
      );

      return {
        bet: createdBet,
        walletBalance: new Prisma.Decimal(updatedWallet.balance),
      };
    });

    return bet;
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

    return this.prisma.$transaction(async (tx) => {
      const bets = await tx.bet.findMany({
        where: {
          userId,
          roundId,
          result: BetResult.PENDING,
        },
      });

      const refundedAmount = bets.reduce(
        (sum, bet) => sum.add(bet.amount),
        new Prisma.Decimal(0),
      );

      if (bets.length) {
        await tx.bet.deleteMany({
          where: {
            userId,
            roundId,
            result: BetResult.PENDING,
          },
        });
      }

      const wallet = await this.walletService.adjustBalance(
        userId,
        refundedAmount,
        tx,
      );

      return {
        roundId,
        cleared: bets.length,
        refundedAmount,
        walletBalance: new Prisma.Decimal(wallet.balance),
      };
    });
  }

  async settleRound(
    roundId: number,
    winningSide: BetSide | null,
    digitOutcome: DigitOutcome | null,
    digitBonusSlots: DigitBonusSlot[] = [],
    digitBonusFactor: number | null = null,
  ): Promise<SettlementStats> {
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
          );
          if (payoutMultiplier !== null) {
            const isBonus = isBonusDigitBet(
              bet.digitType,
              bet.selection ?? null,
              digitBonusSlots,
            );
            const factor = Number(digitBonusFactor ?? 1);
            const boosted =
              isBonus && factor > 1 ? applyBonusFactor(payoutMultiplier, factor) : payoutMultiplier;
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
        return {
          digitType,
          selection: null,
          odds: new Prisma.Decimal(DIGIT_PAYOUTS.smallBigOddEven),
        };
      case DigitBetType.ANY_TRIPLE:
        if (cleanSelection) {
          throw new BadRequestException('Selection is not needed for this bet');
        }
        return {
          digitType,
          selection: null,
          odds: new Prisma.Decimal(DIGIT_PAYOUTS.anyTriple),
        };
      case DigitBetType.DOUBLE: {
        const normalized = this.normalizeDoubleSelection(cleanSelection);
        return {
          digitType,
          selection: normalized,
          odds: new Prisma.Decimal(DIGIT_PAYOUTS.double),
        };
      }
      case DigitBetType.TRIPLE: {
        const normalized = this.normalizeTripleSelection(cleanSelection);
        return {
          digitType,
          selection: normalized,
          odds: new Prisma.Decimal(DIGIT_PAYOUTS.triple),
        };
      }
      case DigitBetType.SUM: {
        const normalized = this.normalizeSumSelection(cleanSelection);
        const payout = DIGIT_PAYOUTS.sum[normalized];
        return {
          digitType,
          selection: String(normalized),
          odds: new Prisma.Decimal(payout),
        };
      }
      case DigitBetType.SINGLE: {
        const normalized = this.normalizeSingleSelection(cleanSelection);
        return {
          digitType,
          selection: normalized,
          odds: new Prisma.Decimal(DIGIT_PAYOUTS.single.single),
        };
      }
      default:
        throw new BadRequestException('Unsupported digit bet type');
    }
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

  private normalizeSumSelection(selection?: string | null): SumKey {
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
    if (!this.isSumKey(sum)) {
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

  private resolveDigitPayout(bet: Bet, outcome: DigitOutcome): number | null {
    if (!bet.digitType) {
      return null;
    }

    const sum = outcome.sum;
    const isTriple = outcome.isTriple;
    const selection = bet.selection ?? '';
    const countFor = (digit: string) => outcome.counts[digit] ?? 0;

    switch (bet.digitType) {
      case DigitBetType.SMALL:
        return !isTriple &&
          sum >= DIGIT_SUM_RANGES.small.min &&
          sum <= DIGIT_SUM_RANGES.small.max
          ? DIGIT_PAYOUTS.smallBigOddEven
          : null;
      case DigitBetType.BIG:
        return !isTriple &&
          sum >= DIGIT_SUM_RANGES.big.min &&
          sum <= DIGIT_SUM_RANGES.big.max
          ? DIGIT_PAYOUTS.smallBigOddEven
          : null;
      case DigitBetType.ODD:
        return !isTriple && sum % 2 === 1
          ? DIGIT_PAYOUTS.smallBigOddEven
          : null;
      case DigitBetType.EVEN:
        return !isTriple && sum % 2 === 0
          ? DIGIT_PAYOUTS.smallBigOddEven
          : null;
      case DigitBetType.ANY_TRIPLE:
        return isTriple ? DIGIT_PAYOUTS.anyTriple : null;
      case DigitBetType.TRIPLE:
        return isTriple && selection === outcome.digits
          ? DIGIT_PAYOUTS.triple
          : null;
      case DigitBetType.DOUBLE: {
        const digit = selection[0];
        return digit && countFor(digit) >= 2 ? DIGIT_PAYOUTS.double : null;
      }
      case DigitBetType.SUM: {
        const target = Number(selection);
        if (!Number.isFinite(target) || !this.isSumKey(target)) {
          return null;
        }
        return sum === target ? DIGIT_PAYOUTS.sum[target] : null;
      }
      case DigitBetType.SINGLE: {
        const digit = selection[0];
        if (!digit) {
          return null;
        }
        const count = countFor(digit);
        if (count === 1) {
          return DIGIT_PAYOUTS.single.single;
        }
        if (count === 2) {
          return DIGIT_PAYOUTS.single.double;
        }
        if (count === 3) {
          return DIGIT_PAYOUTS.single.triple;
        }
        return null;
      }
      default:
        return null;
    }
  }

  private isSumKey(value: number): value is SumKey {
    return Object.prototype.hasOwnProperty.call(DIGIT_PAYOUTS.sum, value);
  }
}
