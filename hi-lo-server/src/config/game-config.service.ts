import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildDefaultDigitPayouts,
  buildDefaultGameConfig,
  type DigitPayouts,
  type GameConfigSnapshot,
} from './game-config.defaults';

export interface GameConfigInput {
  bettingDurationMs: number;
  resultDurationMs: number;
  resultDisplayDurationMs: number;
  minBetAmount: number;
  maxBetAmount: number;
  payoutMultiplierUp: number;
  payoutMultiplierDown: number;
  priceSnapshotInterval: number;
  digitPayouts: unknown;
}

type CacheEntry = {
  value: GameConfigSnapshot;
  expiresAt: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown, fallback: number) => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const requireNumber = (value: unknown, label: string) => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return num;
};

@Injectable()
export class GameConfigService {
  private cache: CacheEntry | null = null;
  private readonly cacheTtlMs = 3000;

  constructor(private readonly prisma: PrismaService) {}

  getDefaultConfig(): GameConfigSnapshot {
    return buildDefaultGameConfig();
  }

  async getActiveConfig(): Promise<GameConfigSnapshot> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }

    const record = await this.prisma.gameConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    const config = record ? this.fromRecord(record) : this.getDefaultConfig();
    this.cache = { value: config, expiresAt: now + this.cacheTtlMs };
    return config;
  }

  normalizeSnapshot(raw: unknown): GameConfigSnapshot {
    const defaults = this.getDefaultConfig();
    if (!isRecord(raw)) {
      return defaults;
    }

    const digitPayouts = this.mergeDigitPayouts(raw.digitPayouts, defaults.digitPayouts);
    const configVersion =
      typeof raw.configVersion === 'string' ? raw.configVersion : defaults.configVersion;

    return {
      configVersion,
      bettingDurationMs: toNumber(raw.bettingDurationMs, defaults.bettingDurationMs),
      resultDurationMs: toNumber(raw.resultDurationMs, defaults.resultDurationMs),
      resultDisplayDurationMs: toNumber(
        raw.resultDisplayDurationMs,
        defaults.resultDisplayDurationMs,
      ),
      minBetAmount: toNumber(raw.minBetAmount, defaults.minBetAmount),
      maxBetAmount: toNumber(raw.maxBetAmount, defaults.maxBetAmount),
      payoutMultiplierUp: toNumber(raw.payoutMultiplierUp, defaults.payoutMultiplierUp),
      payoutMultiplierDown: toNumber(
        raw.payoutMultiplierDown,
        defaults.payoutMultiplierDown,
      ),
      priceSnapshotInterval: toNumber(
        raw.priceSnapshotInterval,
        defaults.priceSnapshotInterval,
      ),
      digitPayouts,
    };
  }

  async updateFromInput(input: GameConfigInput): Promise<GameConfigSnapshot> {
    const digitPayouts = this.parseDigitPayouts(input.digitPayouts);
    const config: GameConfigSnapshot = {
      bettingDurationMs: requireNumber(input.bettingDurationMs, 'bettingDurationMs'),
      resultDurationMs: requireNumber(input.resultDurationMs, 'resultDurationMs'),
      resultDisplayDurationMs: requireNumber(
        input.resultDisplayDurationMs,
        'resultDisplayDurationMs',
      ),
      minBetAmount: requireNumber(input.minBetAmount, 'minBetAmount'),
      maxBetAmount: requireNumber(input.maxBetAmount, 'maxBetAmount'),
      payoutMultiplierUp: requireNumber(input.payoutMultiplierUp, 'payoutMultiplierUp'),
      payoutMultiplierDown: requireNumber(
        input.payoutMultiplierDown,
        'payoutMultiplierDown',
      ),
      priceSnapshotInterval: requireNumber(
        input.priceSnapshotInterval,
        'priceSnapshotInterval',
      ),
      digitPayouts,
    };

    this.validateConfig(config);
    return this.updateConfig(config);
  }

  async updateConfig(config: GameConfigSnapshot): Promise<GameConfigSnapshot> {
    const existing = await this.prisma.gameConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    const data = this.toRecordData(config);

    const saved = existing
      ? await this.prisma.gameConfig.update({ where: { id: existing.id }, data })
      : await this.prisma.gameConfig.create({ data });

    const next = this.fromRecord(saved);
    this.cache = { value: next, expiresAt: Date.now() + this.cacheTtlMs };
    return next;
  }

  private validateConfig(config: GameConfigSnapshot) {
    if (config.bettingDurationMs < 0) {
      throw new BadRequestException('bettingDurationMs must be >= 0');
    }
    if (config.resultDurationMs < 0) {
      throw new BadRequestException('resultDurationMs must be >= 0');
    }
    if (config.resultDisplayDurationMs < 0) {
      throw new BadRequestException('resultDisplayDurationMs must be >= 0');
    }
    if (config.minBetAmount < 0 || config.maxBetAmount < 0) {
      throw new BadRequestException('Bet amounts must be >= 0');
    }
    if (config.maxBetAmount < config.minBetAmount) {
      throw new BadRequestException('maxBetAmount must be >= minBetAmount');
    }
    if (config.payoutMultiplierUp < 0 || config.payoutMultiplierDown < 0) {
      throw new BadRequestException('Payout multipliers must be >= 0');
    }
    if (config.priceSnapshotInterval <= 0) {
      throw new BadRequestException('priceSnapshotInterval must be > 0');
    }
  }

  private parseDigitPayouts(raw: unknown): DigitPayouts {
    if (!isRecord(raw)) {
      throw new BadRequestException('digitPayouts is required');
    }

    const defaults = buildDefaultDigitPayouts();
    const singleRaw = raw.single;
    if (!isRecord(singleRaw)) {
      throw new BadRequestException('digitPayouts.single is required');
    }
    const sumRaw = raw.sum;
    if (!isRecord(sumRaw)) {
      throw new BadRequestException('digitPayouts.sum is required');
    }

    const sum: Record<number, number> = {};
    for (const key of Object.keys(defaults.sum)) {
      sum[Number(key)] = requireNumber(
        sumRaw[key],
        `digitPayouts.sum.${key}`,
      );
    }

    return {
      smallBigOddEven: requireNumber(raw.smallBigOddEven, 'digitPayouts.smallBigOddEven'),
      anyTriple: requireNumber(raw.anyTriple, 'digitPayouts.anyTriple'),
      double: requireNumber(raw.double, 'digitPayouts.double'),
      triple: requireNumber(raw.triple, 'digitPayouts.triple'),
      single: {
        single: requireNumber(singleRaw.single, 'digitPayouts.single.single'),
        double: requireNumber(singleRaw.double, 'digitPayouts.single.double'),
        triple: requireNumber(singleRaw.triple, 'digitPayouts.single.triple'),
      },
      sum,
    };
  }

  private mergeDigitPayouts(raw: unknown, fallback: DigitPayouts): DigitPayouts {
    if (!isRecord(raw)) {
      return fallback;
    }

    const singleRaw = isRecord(raw.single) ? raw.single : {};
    const sumRaw = isRecord(raw.sum) ? raw.sum : {};

    const sum: Record<number, number> = {};
    for (const key of Object.keys(fallback.sum)) {
      sum[Number(key)] = toNumber(sumRaw[key], fallback.sum[Number(key)]);
    }

    return {
      smallBigOddEven: toNumber(raw.smallBigOddEven, fallback.smallBigOddEven),
      anyTriple: toNumber(raw.anyTriple, fallback.anyTriple),
      double: toNumber(raw.double, fallback.double),
      triple: toNumber(raw.triple, fallback.triple),
      single: {
        single: toNumber(singleRaw.single, fallback.single.single),
        double: toNumber(singleRaw.double, fallback.single.double),
        triple: toNumber(singleRaw.triple, fallback.single.triple),
      },
      sum,
    };
  }

  private fromRecord(record: {
    bettingDurationMs: number;
    resultDurationMs: number;
    resultDisplayDurationMs: number;
    minBetAmount: Prisma.Decimal;
    maxBetAmount: Prisma.Decimal;
    payoutMultiplierUp: Prisma.Decimal;
    payoutMultiplierDown: Prisma.Decimal;
    priceSnapshotInterval: number;
    digitPayouts: unknown;
    updatedAt: Date;
  }): GameConfigSnapshot {
    const defaults = this.getDefaultConfig();
    return {
      configVersion: record.updatedAt.toISOString(),
      bettingDurationMs: record.bettingDurationMs,
      resultDurationMs: record.resultDurationMs,
      resultDisplayDurationMs: record.resultDisplayDurationMs,
      minBetAmount: Number(record.minBetAmount),
      maxBetAmount: Number(record.maxBetAmount),
      payoutMultiplierUp: Number(record.payoutMultiplierUp),
      payoutMultiplierDown: Number(record.payoutMultiplierDown),
      priceSnapshotInterval: record.priceSnapshotInterval,
      digitPayouts: this.mergeDigitPayouts(record.digitPayouts, defaults.digitPayouts),
    };
  }

  private toJsonDigitPayouts(payouts: DigitPayouts): Prisma.InputJsonValue {
    const sum: Record<string, number> = {};
    for (const [key, value] of Object.entries(payouts.sum)) {
      sum[key] = value;
    }

    return {
      smallBigOddEven: payouts.smallBigOddEven,
      anyTriple: payouts.anyTriple,
      double: payouts.double,
      triple: payouts.triple,
      single: {
        single: payouts.single.single,
        double: payouts.single.double,
        triple: payouts.single.triple,
      },
      sum,
    };
  }

  private toRecordData(config: GameConfigSnapshot) {
    return {
      bettingDurationMs: config.bettingDurationMs,
      resultDurationMs: config.resultDurationMs,
      resultDisplayDurationMs: config.resultDisplayDurationMs,
      minBetAmount: new Prisma.Decimal(config.minBetAmount),
      maxBetAmount: new Prisma.Decimal(config.maxBetAmount),
      payoutMultiplierUp: new Prisma.Decimal(config.payoutMultiplierUp),
      payoutMultiplierDown: new Prisma.Decimal(config.payoutMultiplierDown),
      priceSnapshotInterval: config.priceSnapshotInterval,
      digitPayouts: this.toJsonDigitPayouts(config.digitPayouts),
    };
  }
}
