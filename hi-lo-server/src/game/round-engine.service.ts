import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BetSide,
  DigitBetType,
  Prisma,
  Round,
  RoundStatus,
} from '@prisma/client';
import { Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { BinancePriceService } from '../binance/binance.service';
import { RedisService } from '../redis/redis.service';
import { CacheKeys } from '../common/constants/cache-keys';
import { RoundState } from './interfaces/round-state.interface';
import { RoundEvent } from './interfaces/round-event.interface';
import { BetsService } from '../bets/bets.service';
import { AppConfig } from '../config/configuration';
import { getDigitOutcome } from './digit-bet.utils';
import {
  DEFAULT_BONUS_SLOT_CHANCE_TOTAL,
  buildDigitBonusKey,
  getAllDigitBetSlots,
  pickBonusRatioWithChance,
  pickWeightedBonusRatio,
  type DigitBonusSlot,
} from './digit-bonus.utils';
import { GameConfigService } from '../config/game-config.service';
import { GameConfigSnapshot } from '../config/game-config.defaults';

const COMPLETE_PHASE_DURATION_MS = 10_000;

type RoundConfigSnapshot = GameConfigSnapshot & {
  merchantSnapshots?: Record<string, GameConfigSnapshot>;
};

@Injectable()
export class RoundEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoundEngineService.name);
  private readonly eventsSubject = new Subject<RoundEvent>();
  private readonly roundStateTtlMs: number;
  private readonly digitBonusConfig: AppConfig['game']['digitBonus'];
  private currentConfig?: GameConfigSnapshot;

  private lockTimer?: NodeJS.Timeout;
  private resultTimer?: NodeJS.Timeout;
  private nextRoundTimer?: NodeJS.Timeout;
  private currentRound?: RoundState;
  private disposed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly gameConfigService: GameConfigService,
    private readonly binancePrice: BinancePriceService,
    private readonly redis: RedisService,
    private readonly betsService: BetsService,
  ) {
    this.roundStateTtlMs = this.configService.getOrThrow<number>(
      'roundState.ttlMs',
      { infer: true },
    );

    this.digitBonusConfig = this.configService.getOrThrow('game.digitBonus', {
      infer: true,
    });
  }

  async onModuleInit() {
    const restored = await this.restoreActiveRound();
    if (!restored) {
      await this.startNewRound();
    }
  }

  async onModuleDestroy() {
    this.disposed = true;
    this.eventsSubject.complete();
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
    }
    if (this.resultTimer) {
      clearTimeout(this.resultTimer);
    }
    if (this.nextRoundTimer) {
      clearTimeout(this.nextRoundTimer);
    }
  }

  events$() {
    return this.eventsSubject.asObservable();
  }

  getCurrentRound(): RoundState | undefined {
    return this.currentRound;
  }

  private async startNewRound() {
    if (this.disposed) {
      return;
    }
    const now = Date.now();
    const config = await this.gameConfigService.getActiveConfig();
    const merchantSnapshots =
      await this.gameConfigService.getMerchantConfigSnapshots();
    const runtimeVersion =
      await this.gameConfigService.getRuntimeConfigVersionTag();
    const roundConfig: RoundConfigSnapshot = {
      ...config,
      configVersion: runtimeVersion,
      merchantSnapshots,
    };
    this.currentConfig = roundConfig;
    const start = new Date(now);
    const lock = new Date(now + roundConfig.bettingDurationMs);
    const end = new Date(lock.getTime() + roundConfig.resultDurationMs);
    const oddsUp = roundConfig.payoutMultiplierUp;
    const oddsDown = roundConfig.payoutMultiplierDown;

    const round = await this.prisma.round.create({
      data: {
        startTime: start,
        lockTime: lock,
        endTime: end,
        oddsUp: new Prisma.Decimal(oddsUp),
        oddsDown: new Prisma.Decimal(oddsDown),
        gameConfigSnapshot: roundConfig as unknown as Prisma.InputJsonValue,
        // Keep bonus slots hidden during BETTING; generate and reveal at lock.
        digitBonusSlots: [] as unknown as Prisma.InputJsonValue,
        digitBonusFactor: null,
        status: RoundStatus.BETTING,
      },
    });

    this.currentRound = this.toRoundState(round);
    await this.cacheRoundState();
    this.eventsSubject.next({
      type: 'round:start',
      payload: this.currentRound,
    });

    const lockDelay = Math.max(lock.getTime() - Date.now(), 0);
    this.lockTimer = setTimeout(() => {
      void this.lockCurrentRound();
    }, lockDelay);
  }

  private async restoreActiveRound() {
    const cachedState = await this.redis.getJson<RoundState>(
      CacheKeys.activeRoundState,
    );
    if (cachedState) {
      const normalizedCachedState = this.normalizeRoundStateForBroadcast(cachedState);
      this.currentRound = normalizedCachedState;
      await this.loadRoundConfigSnapshot(cachedState.id);
      if (this.resumeTimersAfterRestore(normalizedCachedState)) {
        await this.cacheRoundState();
        this.eventsSubject.next({
          type: 'round:start',
          payload: normalizedCachedState,
        });
        return true;
      }
      this.currentRound = undefined;
      this.currentConfig = undefined;
    }

    const round = await this.prisma.round.findFirst({
      where: {
        status: {
          in: [RoundStatus.BETTING, RoundStatus.RESULT_PENDING],
        },
      },
      orderBy: { id: 'desc' },
    });

    if (!round) {
      return false;
    }

    const restoredState = this.toRoundState(round);
    this.currentRound = restoredState;
    this.currentConfig = this.gameConfigService.normalizeSnapshot(
      round.gameConfigSnapshot,
    );

    if (restoredState.status === RoundStatus.RESULT_PENDING) {
      try {
        // Batch-write: if the server restarted after lock, ensure slips are committed.
        await this.betsService.commitBetSlipsForRound(restoredState.id);
      } catch (error) {
        this.logger.warn(
          `Slip commit on restore failed for round ${restoredState.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (!this.resumeTimersAfterRestore(restoredState)) {
      this.currentRound = undefined;
      this.currentConfig = undefined;
      return false;
    }

    await this.cacheRoundState();
    this.eventsSubject.next({
      type: 'round:start',
      payload: this.currentRound,
    });

    return true;
  }

  private async lockCurrentRound() {
    if (!this.currentRound) {
      return;
    }

    const lockedPrice = await this.fetchLatestPrice();
    const lockedPhaseBonus = this.buildLockedPhaseBonus(this.currentConfig);
    const bonusSlots = lockedPhaseBonus?.slots ?? [];
    const bonusFactor = lockedPhaseBonus?.factor ?? null;

    try {
      await this.prisma.round.update({
        where: { id: this.currentRound.id },
        data: {
          status: RoundStatus.RESULT_PENDING,
          lockedPrice:
            lockedPrice !== null ? new Prisma.Decimal(lockedPrice) : null,
          digitBonusSlots: bonusSlots as unknown as Prisma.InputJsonValue,
          digitBonusFactor:
            bonusFactor !== null ? new Prisma.Decimal(bonusFactor) : null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to lock round ${this.currentRound.id}`, error);
      return;
    }

    try {
      // Batch-write: persist all pending bet slips into Bet rows at lock.
      await this.betsService.commitBetSlipsForRound(this.currentRound.id);
    } catch (error) {
      this.logger.warn(
        `Failed to commit bet slips for round ${this.currentRound.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.currentRound = {
      ...this.currentRound,
      status: RoundStatus.RESULT_PENDING,
      lockedPrice,
      digitBonus: lockedPhaseBonus,
    };
    await this.cacheRoundState();
    this.eventsSubject.next({
      type: 'round:locked',
      payload: {
        roundId: this.currentRound.id,
        lockedPrice,
        digitBonus: lockedPhaseBonus,
      },
    });

    const remaining = Math.max(
      new Date(this.currentRound.endTime).getTime() - Date.now(),
      0,
    );
    this.resultTimer = setTimeout(() => {
      void this.finishCurrentRound();
    }, remaining);
  }

  private async finishCurrentRound() {
    if (!this.currentRound) {
      return;
    }

    const finalPrice = await this.fetchLatestPrice();
    const locked = this.currentRound.lockedPrice ?? finalPrice;
    const digitOutcome =
      finalPrice !== null ? getDigitOutcome(finalPrice) : null;
    const digitResult = digitOutcome?.digits ?? null;
    const digitSum = digitOutcome?.sum ?? null;
    let winningSide: BetSide | null = null;
    if (locked !== null && finalPrice !== null) {
      if (finalPrice > locked) {
        winningSide = BetSide.UP;
      } else if (finalPrice < locked) {
        winningSide = BetSide.DOWN;
      }
    }

    let stats;
    try {
      stats = await this.betsService.settleRound(
        this.currentRound.id,
        winningSide,
        digitOutcome,
        this.currentRound.digitBonus?.slots ?? [],
        this.currentRound.digitBonus?.factor ?? null,
      );
      await this.prisma.round.update({
        where: { id: this.currentRound.id },
        data: {
          status: RoundStatus.COMPLETED,
          finalPrice:
            finalPrice !== null ? new Prisma.Decimal(finalPrice) : null,
          winningSide,
          digitResult,
          digitSum,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to finalize round ${this.currentRound.id}`,
        error,
      );
    }

    if (!stats) {
      stats = {
        totalBets: 0,
        winners: 0,
        refunded: 0,
        totalVolume: 0,
        balanceUpdates: [],
      };
    }

    this.eventsSubject.next({
      type: 'round:result',
      payload: {
        roundId: this.currentRound.id,
        lockedPrice: this.currentRound.lockedPrice ?? null,
        finalPrice,
        digitResult,
        digitSum,
        winningSide,
        stats,
      },
    });

    this.currentRound = undefined;
    const displayDelay = COMPLETE_PHASE_DURATION_MS;
    this.currentConfig = undefined;
    await this.redis.del(CacheKeys.activeRoundState);

    if (this.nextRoundTimer) {
      clearTimeout(this.nextRoundTimer);
    }
    this.nextRoundTimer = setTimeout(() => {
      void this.startNewRound();
    }, displayDelay);
  }

  private async fetchLatestPrice(): Promise<number | null> {
    const latest = await this.binancePrice.getLatestPrice();
    return latest?.price ?? null;
  }

  private async cacheRoundState() {
    if (!this.currentRound) {
      return;
    }

    await this.redis.setJson(
      CacheKeys.activeRoundState,
      this.currentRound,
      this.roundStateTtlMs,
    );
  }

  private async loadRoundConfigSnapshot(roundId: number) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: { gameConfigSnapshot: true },
    });
    this.currentConfig = this.gameConfigService.normalizeSnapshot(
      round?.gameConfigSnapshot,
    );
  }

  private toRoundState(round: Round): RoundState {
    const slots = this.parseBonusSlots(round.digitBonusSlots);
    const factor =
      round.digitBonusFactor !== null && round.digitBonusFactor !== undefined
        ? Number(round.digitBonusFactor)
        : null;
    const shouldExposeBonus = round.status !== RoundStatus.BETTING;
    const configVersion =
      this.gameConfigService.normalizeSnapshot(round.gameConfigSnapshot)
        .configVersion ?? null;
    return {
      id: round.id,
      status: round.status,
      startTime: round.startTime.toISOString(),
      lockTime: round.lockTime.toISOString(),
      endTime: round.endTime.toISOString(),
      oddsUp: Number(round.oddsUp),
      oddsDown: Number(round.oddsDown),
      configVersion,
      digitBonus:
        shouldExposeBonus &&
        (slots.length > 0 || (factor !== null && factor !== undefined))
          ? { factor: factor ?? 1, slots }
          : undefined,
      lockedPrice: round.lockedPrice ? Number(round.lockedPrice) : null,
      finalPrice: round.finalPrice ? Number(round.finalPrice) : null,
      winningSide: round.winningSide,
    };
  }

  private buildLockedPhaseBonus(
    config?: GameConfigSnapshot,
  ): RoundState['digitBonus'] | undefined {
    if (!config || !config.bonusModeEnabled) {
      return undefined;
    }

    const bonusChanceTotal = Number(
      config.bonusSlotChanceTotal ?? DEFAULT_BONUS_SLOT_CHANCE_TOTAL,
    );
    const slots: DigitBonusSlot[] = [];
    const allSlots = getAllDigitBetSlots();
    allSlots.forEach((slot) => {
      const key = buildDigitBonusKey(slot);
      const entry = config.digitBonusRatios?.[key];
      const bonusRatio = entry
        ? pickBonusRatioWithChance(
            entry.ratios,
            entry.weights,
            Math.random,
            bonusChanceTotal,
          )
        : null;
      if (bonusRatio !== null && bonusRatio !== undefined) {
        slots.push({ ...slot, bonusRatio });
      }
    });

    // Ensure pending phase always has at least one visible bonus slot when bonus mode is enabled.
    if (slots.length === 0) {
      const fallbackSlots: DigitBonusSlot[] = [];
      allSlots.forEach((slot) => {
        const key = buildDigitBonusKey(slot);
        const entry = config.digitBonusRatios?.[key];
        if (!entry) return;
        const bonusRatio = pickWeightedBonusRatio(
          entry.ratios,
          entry.weights,
          Math.random,
        );
        if (bonusRatio !== null && bonusRatio !== undefined) {
          fallbackSlots.push({ ...slot, bonusRatio });
        }
      });
      if (fallbackSlots.length > 0) {
        const picked =
          fallbackSlots[Math.floor(Math.random() * fallbackSlots.length)];
        if (picked) {
          slots.push(picked);
        }
      }
    }

    return {
      factor: Number(this.digitBonusConfig?.payoutFactor ?? 1),
      slots,
    };
  }

  private parseBonusSlots(value: unknown): Array<{
    digitType: DigitBetType;
    selection: string | null;
    bonusRatio?: number | null;
  }> {
    if (!Array.isArray(value)) return [];
    const allowed = new Set(Object.values(DigitBetType));
    const slots: Array<{
      digitType: DigitBetType;
      selection: string | null;
      bonusRatio?: number | null;
    }> = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const digitType = item.digitType as unknown;
      const selection = item.selection;
      const bonusRatio = item.bonusRatio;
      if (
        typeof digitType !== 'string' ||
        !allowed.has(digitType as DigitBetType)
      )
        continue;
      if (
        selection !== null &&
        selection !== undefined &&
        typeof selection !== 'string'
      )
        continue;
      const ratio =
        typeof bonusRatio === 'number' && Number.isFinite(bonusRatio)
          ? bonusRatio
          : null;
      slots.push({
        digitType: digitType as DigitBetType,
        selection: selection ?? null,
        bonusRatio: ratio,
      });
    }
    return slots;
  }

  private normalizeRoundStateForBroadcast(state: RoundState): RoundState {
    if (state.status !== RoundStatus.BETTING) {
      return state;
    }
    if (!state.digitBonus) {
      return state;
    }
    return {
      ...state,
      digitBonus: undefined,
    };
  }

  private resumeTimersAfterRestore(state: RoundState) {
    if (state.status === RoundStatus.BETTING) {
      const delay = Math.max(
        new Date(state.lockTime).getTime() - Date.now(),
        0,
      );
      this.lockTimer = setTimeout(() => {
        void this.lockCurrentRound();
      }, delay);
      return true;
    }

    if (state.status === RoundStatus.RESULT_PENDING) {
      this.eventsSubject.next({
        type: 'round:locked',
        payload: {
          roundId: state.id,
          lockedPrice: state.lockedPrice ?? null,
          digitBonus: state.digitBonus,
        },
      });
      const delay = Math.max(new Date(state.endTime).getTime() - Date.now(), 0);
      this.resultTimer = setTimeout(() => {
        void this.finishCurrentRound();
      }, delay);
      return true;
    }

    return false;
  }
}
