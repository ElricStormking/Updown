import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildDefaultDigitBonusRatios,
  buildDefaultDigitPayouts,
  buildDefaultGameConfig,
  type DigitBonusRatios,
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
  bonusSlotChanceTotal?: unknown;
  digitPayouts: unknown;
  digitBonusRatios?: unknown;
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

    const digitPayouts = this.mergeDigitPayouts(
      raw.digitPayouts,
      defaults.digitPayouts,
    );
    const digitBonusRatios = this.mergeDigitBonusRatios(
      raw.digitBonusRatios,
      defaults.digitBonusRatios,
    );
    const bonusSlotChanceTotal = toNumber(
      this.extractBonusSlotChanceTotalSource(raw),
      defaults.bonusSlotChanceTotal,
    );
    const configVersion =
      typeof raw.configVersion === 'string'
        ? raw.configVersion
        : defaults.configVersion;

    return {
      configVersion,
      bettingDurationMs: toNumber(
        raw.bettingDurationMs,
        defaults.bettingDurationMs,
      ),
      resultDurationMs: toNumber(
        raw.resultDurationMs,
        defaults.resultDurationMs,
      ),
      resultDisplayDurationMs: toNumber(
        raw.resultDisplayDurationMs,
        defaults.resultDisplayDurationMs,
      ),
      minBetAmount: toNumber(raw.minBetAmount, defaults.minBetAmount),
      maxBetAmount: toNumber(raw.maxBetAmount, defaults.maxBetAmount),
      payoutMultiplierUp: toNumber(
        raw.payoutMultiplierUp,
        defaults.payoutMultiplierUp,
      ),
      payoutMultiplierDown: toNumber(
        raw.payoutMultiplierDown,
        defaults.payoutMultiplierDown,
      ),
      priceSnapshotInterval: toNumber(
        raw.priceSnapshotInterval,
        defaults.priceSnapshotInterval,
      ),
      bonusSlotChanceTotal,
      digitPayouts,
      digitBonusRatios,
    };
  }

  async updateFromInput(input: GameConfigInput): Promise<GameConfigSnapshot> {
    const digitPayouts = this.parseDigitPayouts(input.digitPayouts);
    const digitBonusRatios = this.parseDigitBonusRatios(input.digitBonusRatios);
    const config: GameConfigSnapshot = {
      bettingDurationMs: requireNumber(
        input.bettingDurationMs,
        'bettingDurationMs',
      ),
      resultDurationMs: requireNumber(
        input.resultDurationMs,
        'resultDurationMs',
      ),
      resultDisplayDurationMs: requireNumber(
        input.resultDisplayDurationMs,
        'resultDisplayDurationMs',
      ),
      minBetAmount: requireNumber(input.minBetAmount, 'minBetAmount'),
      maxBetAmount: requireNumber(input.maxBetAmount, 'maxBetAmount'),
      payoutMultiplierUp: requireNumber(
        input.payoutMultiplierUp,
        'payoutMultiplierUp',
      ),
      payoutMultiplierDown: requireNumber(
        input.payoutMultiplierDown,
        'payoutMultiplierDown',
      ),
      priceSnapshotInterval: requireNumber(
        input.priceSnapshotInterval,
        'priceSnapshotInterval',
      ),
      bonusSlotChanceTotal: requireNumber(
        input.bonusSlotChanceTotal,
        'bonusSlotChanceTotal',
      ),
      digitPayouts,
      digitBonusRatios,
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
      ? await this.prisma.gameConfig.update({
          where: { id: existing.id },
          data,
        })
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
    if (config.bonusSlotChanceTotal <= 0) {
      throw new BadRequestException('bonusSlotChanceTotal must be > 0');
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
      sum[Number(key)] = requireNumber(sumRaw[key], `digitPayouts.sum.${key}`);
    }

    const bySlot = this.parseSlotPayouts(raw.bySlot, defaults.bySlot, raw);
    const bySlotMeta = this.parseSlotPayoutMeta(
      raw.bySlotMeta,
      defaults.bySlotMeta,
    );

    return {
      smallBigOddEven: requireNumber(
        raw.smallBigOddEven,
        'digitPayouts.smallBigOddEven',
      ),
      anyTriple: requireNumber(raw.anyTriple, 'digitPayouts.anyTriple'),
      double: requireNumber(raw.double, 'digitPayouts.double'),
      triple: requireNumber(raw.triple, 'digitPayouts.triple'),
      single: {
        single: requireNumber(singleRaw.single, 'digitPayouts.single.single'),
        double: requireNumber(singleRaw.double, 'digitPayouts.single.double'),
        triple: requireNumber(singleRaw.triple, 'digitPayouts.single.triple'),
      },
      sum,
      bySlot,
      bySlotMeta,
    };
  }

  private mergeDigitPayouts(
    raw: unknown,
    fallback: DigitPayouts,
  ): DigitPayouts {
    if (!isRecord(raw)) {
      return fallback;
    }

    const singleRaw = isRecord(raw.single) ? raw.single : {};
    const sumRaw = isRecord(raw.sum) ? raw.sum : {};

    const sum: Record<number, number> = {};
    for (const key of Object.keys(fallback.sum)) {
      sum[Number(key)] = toNumber(sumRaw[key], fallback.sum[Number(key)]);
    }

    const bySlot = this.mergeSlotPayouts(raw.bySlot, fallback.bySlot, raw);
    const bySlotMeta = this.mergeSlotPayoutMeta(
      raw.bySlotMeta,
      fallback.bySlotMeta,
    );

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
      bySlot,
      bySlotMeta,
    };
  }

  private parseSlotPayouts(
    raw: unknown,
    fallback: Record<string, number>,
    legacy: Record<string, unknown>,
  ): Record<string, number> {
    const rawRecord = isRecord(raw) ? raw : null;
    const result: Record<string, number> = {};
    for (const [key, fallbackValue] of Object.entries(fallback)) {
      if (rawRecord && rawRecord[key] !== undefined) {
        result[key] = requireNumber(
          rawRecord[key],
          `digitPayouts.bySlot.${key}`,
        );
        continue;
      }
      result[key] = this.resolveLegacySlotPayout(
        key,
        legacy,
        fallbackValue,
        true,
      );
    }
    return result;
  }

  private mergeSlotPayouts(
    raw: unknown,
    fallback: Record<string, number>,
    legacy: Record<string, unknown>,
  ): Record<string, number> {
    const rawRecord = isRecord(raw) ? raw : null;
    const result: Record<string, number> = {};
    for (const [key, fallbackValue] of Object.entries(fallback)) {
      if (rawRecord && rawRecord[key] !== undefined) {
        result[key] = toNumber(rawRecord[key], fallbackValue);
        continue;
      }
      result[key] = this.resolveLegacySlotPayout(
        key,
        legacy,
        fallbackValue,
        false,
      );
    }
    return result;
  }

  private parseSlotPayoutMeta(
    raw: unknown,
    fallback: Record<
      string,
      { suggestWinPct: number; rtpFoolProofPct: number; totalCounts: number }
    >,
  ): Record<
    string,
    { suggestWinPct: number; rtpFoolProofPct: number; totalCounts: number }
  > {
    if (!isRecord(raw)) {
      return this.cloneSlotPayoutMeta(fallback);
    }
    const result: Record<
      string,
      { suggestWinPct: number; rtpFoolProofPct: number; totalCounts: number }
    > = {};
    for (const [key, entry] of Object.entries(fallback)) {
      const rawEntry = raw[key];
      result[key] = this.normalizeSlotMetaEntry(rawEntry, entry, true);
    }
    return result;
  }

  private mergeSlotPayoutMeta(
    raw: unknown,
    fallback: Record<
      string,
      { suggestWinPct: number; rtpFoolProofPct: number; totalCounts: number }
    >,
  ): Record<
    string,
    { suggestWinPct: number; rtpFoolProofPct: number; totalCounts: number }
  > {
    if (!isRecord(raw)) {
      return this.cloneSlotPayoutMeta(fallback);
    }
    const result: Record<
      string,
      { suggestWinPct: number; rtpFoolProofPct: number; totalCounts: number }
    > = {};
    for (const [key, entry] of Object.entries(fallback)) {
      const rawEntry = raw[key];
      result[key] = this.normalizeSlotMetaEntry(rawEntry, entry, false);
    }
    return result;
  }

  private normalizeSlotMetaEntry(
    raw: unknown,
    fallback: {
      suggestWinPct: number;
      rtpFoolProofPct: number;
      totalCounts: number;
    },
    strict: boolean,
  ) {
    if (!isRecord(raw)) {
      return { ...fallback };
    }
    return {
      suggestWinPct: strict
        ? requireNumber(raw.suggestWinPct, 'suggestWinPct')
        : toNumber(raw.suggestWinPct, fallback.suggestWinPct),
      rtpFoolProofPct: strict
        ? requireNumber(raw.rtpFoolProofPct, 'rtpFoolProofPct')
        : toNumber(raw.rtpFoolProofPct, fallback.rtpFoolProofPct),
      totalCounts: strict
        ? requireNumber(raw.totalCounts, 'totalCounts')
        : toNumber(raw.totalCounts, fallback.totalCounts),
    };
  }

  private cloneSlotPayoutMeta(
    source: Record<
      string,
      { suggestWinPct: number; rtpFoolProofPct: number; totalCounts: number }
    >,
  ) {
    const result: Record<
      string,
      { suggestWinPct: number; rtpFoolProofPct: number; totalCounts: number }
    > = {};
    for (const [key, entry] of Object.entries(source)) {
      result[key] = { ...entry };
    }
    return result;
  }

  private resolveLegacySlotPayout(
    slotKey: string,
    legacy: Record<string, unknown>,
    fallback: number,
    strict: boolean,
  ): number {
    const digitType = slotKey.split('|')[0];
    const getNumber = (value: unknown, label: string) =>
      strict ? requireNumber(value, label) : toNumber(value, fallback);
    switch (digitType) {
      case 'SMALL':
      case 'ODD':
      case 'EVEN':
      case 'BIG':
        return getNumber(
          legacy.smallBigOddEven,
          'digitPayouts.smallBigOddEven',
        );
      case 'ANY_TRIPLE':
        return getNumber(legacy.anyTriple, 'digitPayouts.anyTriple');
      case 'DOUBLE':
        return getNumber(legacy.double, 'digitPayouts.double');
      case 'TRIPLE':
        return getNumber(legacy.triple, 'digitPayouts.triple');
      case 'SINGLE': {
        const singleRaw = isRecord(legacy.single) ? legacy.single : {};
        return getNumber(singleRaw.single, 'digitPayouts.single.single');
      }
      default:
        return fallback;
    }
  }

  private extractDigitBonusRatiosSource(raw: unknown): unknown {
    if (!isRecord(raw)) {
      return undefined;
    }
    if (raw.digitBonusRatios !== undefined) {
      return raw.digitBonusRatios;
    }
    if (raw.bonusRatios !== undefined) {
      return raw.bonusRatios;
    }
    return undefined;
  }

  private extractBonusSlotChanceTotalSource(raw: unknown): unknown {
    if (!isRecord(raw)) {
      return undefined;
    }
    if (raw.bonusSlotChanceTotal !== undefined) {
      return raw.bonusSlotChanceTotal;
    }
    if (
      isRecord(raw.digitPayouts) &&
      raw.digitPayouts.bonusSlotChanceTotal !== undefined
    ) {
      return raw.digitPayouts.bonusSlotChanceTotal;
    }
    return undefined;
  }

  private parseDigitBonusRatios(raw: unknown): DigitBonusRatios {
    const defaults = buildDefaultDigitBonusRatios();
    return this.mergeDigitBonusRatios(raw, defaults);
  }

  private mergeDigitBonusRatios(
    raw: unknown,
    fallback: DigitBonusRatios,
  ): DigitBonusRatios {
    if (!isRecord(raw)) {
      return this.cloneDigitBonusRatios(fallback);
    }

    const result: DigitBonusRatios = {};
    for (const [key, entry] of Object.entries(fallback)) {
      const rawEntry = raw[key];
      result[key] = this.normalizeBonusRatioEntry(rawEntry, entry);
    }
    return result;
  }

  private normalizeBonusRatioEntry(
    raw: unknown,
    fallback: { ratios: number[]; weights: number[] },
  ) {
    if (!isRecord(raw)) {
      return {
        ratios: fallback.ratios.slice(),
        weights: fallback.weights.slice(),
      };
    }

    const ratios = this.normalizeNumberArray(raw.ratios, fallback.ratios);
    const weights = this.normalizeNumberArray(raw.weights, fallback.weights);
    return { ratios, weights };
  }

  private normalizeNumberArray(raw: unknown, fallback: number[]) {
    if (!Array.isArray(raw) || raw.length !== fallback.length) {
      return fallback.slice();
    }
    const values = raw.map((entry) => Number(entry));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      return fallback.slice();
    }
    return values;
  }

  private cloneDigitBonusRatios(source: DigitBonusRatios): DigitBonusRatios {
    const result: DigitBonusRatios = {};
    for (const [key, entry] of Object.entries(source)) {
      result[key] = {
        ratios: entry.ratios.slice(),
        weights: entry.weights.slice(),
      };
    }
    return result;
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
    const digitPayouts = this.mergeDigitPayouts(
      record.digitPayouts,
      defaults.digitPayouts,
    );
    const digitBonusRatios = this.mergeDigitBonusRatios(
      this.extractDigitBonusRatiosSource(record.digitPayouts),
      defaults.digitBonusRatios,
    );
    const bonusSlotChanceTotal = toNumber(
      this.extractBonusSlotChanceTotalSource(record.digitPayouts),
      defaults.bonusSlotChanceTotal,
    );
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
      bonusSlotChanceTotal,
      digitPayouts,
      digitBonusRatios,
    };
  }

  private toJsonDigitPayouts(
    payouts: DigitPayouts,
    digitBonusRatios: DigitBonusRatios,
    bonusSlotChanceTotal?: number,
  ): Prisma.InputJsonValue {
    const sum: Record<string, number> = {};
    for (const [key, value] of Object.entries(payouts.sum)) {
      sum[key] = value;
    }

    const bonusRatios: Record<string, { ratios: number[]; weights: number[] }> =
      {};
    for (const [key, entry] of Object.entries(digitBonusRatios)) {
      bonusRatios[key] = {
        ratios: entry.ratios.slice(),
        weights: entry.weights.slice(),
      };
    }

    const bySlot: Record<string, number> = {};
    for (const [key, value] of Object.entries(payouts.bySlot)) {
      bySlot[key] = value;
    }
    const bySlotMeta: Record<
      string,
      { suggestWinPct: number; rtpFoolProofPct: number; totalCounts: number }
    > = {};
    for (const [key, value] of Object.entries(payouts.bySlotMeta)) {
      bySlotMeta[key] = {
        suggestWinPct: value.suggestWinPct,
        rtpFoolProofPct: value.rtpFoolProofPct,
        totalCounts: value.totalCounts,
      };
    }

    return {
      smallBigOddEven: payouts.smallBigOddEven,
      anyTriple: payouts.anyTriple,
      double: payouts.double,
      triple: payouts.triple,
      bonusSlotChanceTotal,
      single: {
        single: payouts.single.single,
        double: payouts.single.double,
        triple: payouts.single.triple,
      },
      sum,
      bySlot,
      bySlotMeta,
      digitBonusRatios: bonusRatios,
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
      digitPayouts: this.toJsonDigitPayouts(
        config.digitPayouts,
        config.digitBonusRatios,
        config.bonusSlotChanceTotal,
      ),
    };
  }
}
