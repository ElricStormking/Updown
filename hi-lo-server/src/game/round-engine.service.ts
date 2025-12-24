import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BetSide, Prisma, Round, RoundStatus } from '@prisma/client';
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

@Injectable()
export class RoundEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoundEngineService.name);
  private readonly eventsSubject = new Subject<RoundEvent>();
  private readonly bettingDurationMs: number;
  private readonly resultDurationMs: number;
  private readonly resultDisplayDurationMs: number;
  private readonly roundStateTtlMs: number;

  private lockTimer?: NodeJS.Timeout;
  private resultTimer?: NodeJS.Timeout;
  private nextRoundTimer?: NodeJS.Timeout;
  private currentRound?: RoundState;
  private disposed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly binancePrice: BinancePriceService,
    private readonly redis: RedisService,
    private readonly betsService: BetsService,
  ) {
    this.bettingDurationMs = this.configService.getOrThrow<number>(
      'game.bettingDurationMs',
      { infer: true },
    );
    this.resultDurationMs = this.configService.getOrThrow<number>(
      'game.resultDurationMs',
      { infer: true },
    );
    this.resultDisplayDurationMs = this.configService.getOrThrow<number>(
      'game.resultDisplayDurationMs',
      { infer: true },
    );
    this.roundStateTtlMs = this.configService.getOrThrow<number>(
      'roundState.ttlMs',
      { infer: true },
    );
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
    const start = new Date(now);
    const lock = new Date(now + this.bettingDurationMs);
    const end = new Date(lock.getTime() + this.resultDurationMs);
    const oddsUp = this.getOdds('up');
    const oddsDown = this.getOdds('down');

    const round = await this.prisma.round.create({
      data: {
        startTime: start,
        lockTime: lock,
        endTime: end,
        oddsUp: new Prisma.Decimal(oddsUp),
        oddsDown: new Prisma.Decimal(oddsDown),
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
      this.currentRound = cachedState;
      if (this.resumeTimersAfterRestore(cachedState)) {
        await this.cacheRoundState();
        this.eventsSubject.next({
          type: 'round:start',
          payload: cachedState,
        });
        return true;
      }
      this.currentRound = undefined;
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
    if (!this.resumeTimersAfterRestore(restoredState)) {
      this.currentRound = undefined;
      return false;
    }

    await this.cacheRoundState();
    this.eventsSubject.next({
      type: 'round:start',
      payload: this.currentRound,
    });

    return true;
  }

  private getOdds(direction: 'up' | 'down') {
    if (direction === 'up') {
      return this.configService.getOrThrow<number>('game.payoutMultiplierUp', {
        infer: true,
      });
    }
    return this.configService.getOrThrow<number>('game.payoutMultiplierDown', {
      infer: true,
    });
  }

  private async lockCurrentRound() {
    if (!this.currentRound) {
      return;
    }

    const lockedPrice = await this.fetchLatestPrice();

    try {
      await this.prisma.round.update({
        where: { id: this.currentRound.id },
        data: {
          status: RoundStatus.RESULT_PENDING,
          lockedPrice:
            lockedPrice !== null ? new Prisma.Decimal(lockedPrice) : null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to lock round ${this.currentRound.id}`, error);
      return;
    }

    this.currentRound = {
      ...this.currentRound,
      status: RoundStatus.RESULT_PENDING,
      lockedPrice,
    };
    await this.cacheRoundState();
    this.eventsSubject.next({
      type: 'round:locked',
      payload: {
        roundId: this.currentRound.id,
        lockedPrice,
      },
    });

    const remaining = Math.max(
      this.currentRound
        ? new Date(this.currentRound.endTime).getTime() - Date.now()
        : this.resultDurationMs,
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
    const digitOutcome = finalPrice !== null ? getDigitOutcome(finalPrice) : null;
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
    await this.redis.del(CacheKeys.activeRoundState);

    if (this.nextRoundTimer) {
      clearTimeout(this.nextRoundTimer);
    }
    this.nextRoundTimer = setTimeout(() => {
      void this.startNewRound();
    }, Math.max(this.resultDisplayDurationMs, 0));
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

  private toRoundState(round: Round): RoundState {
    return {
      id: round.id,
      status: round.status,
      startTime: round.startTime.toISOString(),
      lockTime: round.lockTime.toISOString(),
      endTime: round.endTime.toISOString(),
      oddsUp: Number(round.oddsUp),
      oddsDown: Number(round.oddsDown),
      lockedPrice: round.lockedPrice ? Number(round.lockedPrice) : null,
      finalPrice: round.finalPrice ? Number(round.finalPrice) : null,
      winningSide: round.winningSide,
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
