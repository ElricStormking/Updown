import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  type BetAmountLimit,
  type DigitBetAmountLimits,
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
  digitBetAmountLimits?: unknown;
  tokenValues?: unknown;
  payoutMultiplierUp: number;
  payoutMultiplierDown: number;
  priceSnapshotInterval: number;
  bonusModeEnabled?: unknown;
  bonusSlotChanceTotal?: unknown;
  digitPayouts: unknown;
  digitBonusRatios?: unknown;
}

type CacheEntry = {
  value: GameConfigSnapshot;
  expiresAt: number;
};

type MerchantCacheEntry = {
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

const DIGIT_BET_LIMIT_RULE_KEYS = [
  'smallBig',
  'oddEven',
  'double',
  'triple',
  'sum',
  'single',
  'anyTriple',
] as const;

type SlotPayoutMetaEntry = {
  suggestWinPct: number;
  suggestWinPctDouble: number;
  suggestWinPctTriple: number;
  rtpFoolProofPct: number;
  totalCounts: number;
};

@Injectable()
export class GameConfigService {
  private cache: CacheEntry | null = null;
  private merchantCache: Map<string, MerchantCacheEntry> = new Map();
  private readonly cacheTtlMs = 3000;

  constructor(private readonly prisma: PrismaService) {}

  getDefaultConfig(): GameConfigSnapshot {
    return buildDefaultGameConfig();
  }

  async getActiveConfig(
    merchantId?: string | null,
  ): Promise<GameConfigSnapshot> {
    const now = Date.now();

    // If merchantId is provided, get merchant-specific config
    if (merchantId) {
      const cached = this.merchantCache.get(merchantId);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }

      const record = await this.prisma.gameConfig.findUnique({
        where: { merchantId },
      });

      if (record) {
        const config = this.fromRecord(record);
        this.merchantCache.set(merchantId, {
          value: config,
          expiresAt: now + this.cacheTtlMs,
        });
        return config;
      }

      // Fall back to global config if no merchant-specific config exists
    }

    // Global config (merchantId = null)
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }

    const record = await this.prisma.gameConfig.findFirst({
      where: { merchantId: null },
      orderBy: { updatedAt: 'desc' },
    });
    const config = record ? this.fromRecord(record) : this.getDefaultConfig();
    this.cache = { value: config, expiresAt: now + this.cacheTtlMs };
    return config;
  }

  async getMerchantConfig(
    merchantId: string,
  ): Promise<GameConfigSnapshot | null> {
    const record = await this.prisma.gameConfig.findUnique({
      where: { merchantId },
    });
    return record ? this.fromRecord(record) : null;
  }

  async getRuntimeConfigVersionTag(): Promise<string> {
    const latest = await this.prisma.gameConfig.findFirst({
      select: { updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (latest?.updatedAt) {
      return latest.updatedAt.toISOString();
    }
    return this.getDefaultConfig().configVersion ?? 'default';
  }

  async listMerchantConfigs(): Promise<
    Array<{ merchantId: string | null; updatedAt: Date }>
  > {
    const records = await this.prisma.gameConfig.findMany({
      select: { merchantId: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    return records;
  }

  async getMerchantConfigSnapshots(): Promise<
    Record<string, GameConfigSnapshot>
  > {
    const records = await this.prisma.gameConfig.findMany({
      where: { merchantId: { not: null } },
      orderBy: { updatedAt: 'desc' },
    });

    const snapshots: Record<string, GameConfigSnapshot> = {};
    for (const record of records) {
      if (!record.merchantId) continue;
      snapshots[record.merchantId] = this.fromRecord(record);
    }
    return snapshots;
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
    const bonusModeEnabled = this.extractBonusModeEnabledSource(raw);
    const bonusSlotChanceTotal = toNumber(
      this.extractBonusSlotChanceTotalSource(raw),
      defaults.bonusSlotChanceTotal,
    );
    const tokenValues = this.normalizeTokenValues(
      this.extractTokenValuesSource(raw),
      defaults.tokenValues,
    );
    const minBetAmount = toNumber(raw.minBetAmount, defaults.minBetAmount);
    const maxBetAmount = toNumber(raw.maxBetAmount, defaults.maxBetAmount);
    const digitBetAmountLimits = this.mergeDigitBetAmountLimits(
      this.extractDigitBetAmountLimitsSource(raw),
      defaults.digitBetAmountLimits,
      minBetAmount,
      maxBetAmount,
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
      minBetAmount,
      maxBetAmount,
      digitBetAmountLimits,
      tokenValues,
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
      bonusModeEnabled,
      bonusSlotChanceTotal,
      digitPayouts,
      digitBonusRatios,
    };
  }

  async updateFromInput(
    input: GameConfigInput,
    merchantId?: string | null,
  ): Promise<GameConfigSnapshot> {
    const current = await this.getActiveConfig(merchantId ?? null);
    const digitPayouts = this.parseDigitPayouts(input.digitPayouts);
    const digitBonusRatios = this.parseDigitBonusRatios(input.digitBonusRatios);
    const minBetAmount = requireNumber(input.minBetAmount, 'minBetAmount');
    const maxBetAmount = requireNumber(input.maxBetAmount, 'maxBetAmount');
    const digitBetAmountLimits = this.parseDigitBetAmountLimits(
      input.digitBetAmountLimits,
      current.digitBetAmountLimits,
      minBetAmount,
      maxBetAmount,
    );
    const bonusModeEnabled = this.parseBonusModeEnabled(
      input.bonusModeEnabled,
      current.bonusModeEnabled,
    );
    const tokenValues = this.parseTokenValues(
      input.tokenValues,
      current.tokenValues,
    );
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
      minBetAmount,
      maxBetAmount,
      digitBetAmountLimits,
      tokenValues,
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
      bonusModeEnabled,
      bonusSlotChanceTotal:
        input.bonusSlotChanceTotal === undefined
          ? current.bonusSlotChanceTotal
          : requireNumber(input.bonusSlotChanceTotal, 'bonusSlotChanceTotal'),
      digitPayouts,
      digitBonusRatios,
    };

    this.validateConfig(config);
    return this.updateConfig(config, merchantId);
  }

  async updateConfig(
    config: GameConfigSnapshot,
    merchantId?: string | null,
  ): Promise<GameConfigSnapshot> {
    const data = this.toRecordData(config);

    let saved;
    if (merchantId) {
      // Merchant-specific config: upsert by merchantId
      saved = await this.prisma.gameConfig.upsert({
        where: { merchantId },
        update: data,
        create: { ...data, merchantId },
      });
      // Invalidate merchant cache
      this.merchantCache.delete(merchantId);
    } else {
      // Global config (merchantId = null)
      const existing = await this.prisma.gameConfig.findFirst({
        where: { merchantId: null },
        orderBy: { updatedAt: 'desc' },
      });

      saved = existing
        ? await this.prisma.gameConfig.update({
            where: { id: existing.id },
            data,
          })
        : await this.prisma.gameConfig.create({
            data: { ...data, merchantId: null },
          });

      // Invalidate global cache
      this.cache = null;
    }

    const next = this.fromRecord(saved);

    if (merchantId) {
      this.merchantCache.set(merchantId, {
        value: next,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    } else {
      this.cache = { value: next, expiresAt: Date.now() + this.cacheTtlMs };
    }

    return next;
  }

  async copyConfigToMerchant(
    merchantId: string,
    sourceConfig?: GameConfigSnapshot,
  ): Promise<GameConfigSnapshot> {
    const config = sourceConfig ?? (await this.getActiveConfig());
    return this.updateConfig(config, merchantId);
  }

  async deleteConfigForMerchant(merchantId: string): Promise<void> {
    await this.prisma.gameConfig.deleteMany({
      where: { merchantId },
    });
    this.merchantCache.delete(merchantId);
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
    for (const key of DIGIT_BET_LIMIT_RULE_KEYS) {
      const ruleLimit = config.digitBetAmountLimits[key];
      if (!ruleLimit) {
        throw new BadRequestException(
          `digitBetAmountLimits.${key} is required`,
        );
      }
      if (
        !Number.isFinite(ruleLimit.minBetAmount) ||
        !Number.isFinite(ruleLimit.maxBetAmount)
      ) {
        throw new BadRequestException(
          `digitBetAmountLimits.${key} min/max must be numbers`,
        );
      }
      if (ruleLimit.minBetAmount < 0 || ruleLimit.maxBetAmount < 0) {
        throw new BadRequestException(
          `digitBetAmountLimits.${key} min/max must be >= 0`,
        );
      }
      if (ruleLimit.maxBetAmount < ruleLimit.minBetAmount) {
        throw new BadRequestException(
          `digitBetAmountLimits.${key}.maxBetAmount must be >= minBetAmount`,
        );
      }
    }
    if (!Array.isArray(config.tokenValues) || config.tokenValues.length !== 7) {
      throw new BadRequestException('tokenValues must contain 7 entries');
    }
    if (
      config.tokenValues.some((value) => !Number.isFinite(value) || value <= 0)
    ) {
      throw new BadRequestException('tokenValues must be > 0');
    }
    const minTokenValue = Math.min(...config.tokenValues);
    if (config.minBetAmount > minTokenValue) {
      throw new BadRequestException(
        'minBetAmount cannot exceed lowest token value',
      );
    }
    for (const key of DIGIT_BET_LIMIT_RULE_KEYS) {
      if (config.digitBetAmountLimits[key].minBetAmount > minTokenValue) {
        throw new BadRequestException(
          `digitBetAmountLimits.${key}.minBetAmount cannot exceed lowest token value`,
        );
      }
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

  private parseBonusModeEnabled(value: unknown, fallback: boolean) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return fallback;
  }

  private buildBaseBetAmountLimit(
    minBetAmount: number,
    maxBetAmount: number,
  ): BetAmountLimit {
    return {
      minBetAmount,
      maxBetAmount,
    };
  }

  private parseDigitBetAmountLimits(
    raw: unknown,
    fallback: DigitBetAmountLimits,
    minBetAmount: number,
    maxBetAmount: number,
  ): DigitBetAmountLimits {
    if (raw === undefined) {
      return this.mergeDigitBetAmountLimits(
        undefined,
        fallback,
        minBetAmount,
        maxBetAmount,
      );
    }
    if (!isRecord(raw)) {
      throw new BadRequestException('digitBetAmountLimits must be an object');
    }
    return this.mergeDigitBetAmountLimits(
      raw,
      fallback,
      minBetAmount,
      maxBetAmount,
    );
  }

  private mergeDigitBetAmountLimits(
    raw: unknown,
    fallback: DigitBetAmountLimits,
    minBetAmount: number,
    maxBetAmount: number,
  ): DigitBetAmountLimits {
    const rawRecord = isRecord(raw) ? raw : null;
    const baseLimit = this.buildBaseBetAmountLimit(minBetAmount, maxBetAmount);
    const result = {} as DigitBetAmountLimits;

    for (const key of DIGIT_BET_LIMIT_RULE_KEYS) {
      const fallbackEntry = fallback[key] ?? baseLimit;
      result[key] = this.normalizeBetAmountLimitEntry(
        rawRecord?.[key],
        fallbackEntry,
      );
    }
    return result;
  }

  private normalizeBetAmountLimitEntry(
    raw: unknown,
    fallback: BetAmountLimit,
  ): BetAmountLimit {
    if (!isRecord(raw)) {
      return { ...fallback };
    }
    return {
      minBetAmount: toNumber(raw.minBetAmount, fallback.minBetAmount),
      maxBetAmount: toNumber(raw.maxBetAmount, fallback.maxBetAmount),
    };
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

    const doubleBase = requireNumber(raw.double, 'digitPayouts.double');
    const tripleBase = requireNumber(raw.triple, 'digitPayouts.triple');
    const singleBase = requireNumber(
      singleRaw.single,
      'digitPayouts.single.single',
    );
    const singleDouble = requireNumber(
      singleRaw.double,
      'digitPayouts.single.double',
    );
    const singleTriple = requireNumber(
      singleRaw.triple,
      'digitPayouts.single.triple',
    );

    const bySlot = this.parseSlotPayouts(raw.bySlot, defaults.bySlot, raw);
    this.normalizeSingleSlotPayouts(bySlot, singleBase);
    this.normalizeDoubleSlotPayouts(bySlot, doubleBase);
    this.normalizeTripleSlotPayouts(bySlot, tripleBase);
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
      double: doubleBase,
      triple: tripleBase,
      single: {
        single: singleBase,
        double: singleDouble,
        triple: singleTriple,
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

    const doubleBase = toNumber(raw.double, fallback.double);
    const tripleBase = toNumber(raw.triple, fallback.triple);
    const singleBase = toNumber(singleRaw.single, fallback.single.single);
    const singleDouble = toNumber(singleRaw.double, fallback.single.double);
    const singleTriple = toNumber(singleRaw.triple, fallback.single.triple);

    const bySlot = this.mergeSlotPayouts(raw.bySlot, fallback.bySlot, raw);
    this.normalizeSingleSlotPayouts(bySlot, singleBase);
    this.normalizeDoubleSlotPayouts(bySlot, doubleBase);
    this.normalizeTripleSlotPayouts(bySlot, tripleBase);
    const bySlotMeta = this.mergeSlotPayoutMeta(
      raw.bySlotMeta,
      fallback.bySlotMeta,
    );

    return {
      smallBigOddEven: toNumber(raw.smallBigOddEven, fallback.smallBigOddEven),
      anyTriple: toNumber(raw.anyTriple, fallback.anyTriple),
      double: doubleBase,
      triple: tripleBase,
      single: {
        single: singleBase,
        double: singleDouble,
        triple: singleTriple,
      },
      sum,
      bySlot,
      bySlotMeta,
    };
  }

  private normalizeSingleSlotPayouts(
    bySlot: Record<string, number>,
    singleBase: number,
  ) {
    for (const key of Object.keys(bySlot)) {
      if (key.startsWith('SINGLE|')) {
        bySlot[key] = singleBase;
      }
    }
  }

  private normalizeDoubleSlotPayouts(
    bySlot: Record<string, number>,
    doubleBase: number,
  ) {
    for (const key of Object.keys(bySlot)) {
      if (key.startsWith('DOUBLE|')) {
        bySlot[key] = doubleBase;
      }
    }
  }

  private normalizeTripleSlotPayouts(
    bySlot: Record<string, number>,
    tripleBase: number,
  ) {
    for (const key of Object.keys(bySlot)) {
      if (key.startsWith('TRIPLE|')) {
        bySlot[key] = tripleBase;
      }
    }
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
    fallback: Record<string, SlotPayoutMetaEntry>,
  ): Record<string, SlotPayoutMetaEntry> {
    if (!isRecord(raw)) {
      return this.cloneSlotPayoutMeta(fallback);
    }
    const result: Record<string, SlotPayoutMetaEntry> = {};
    for (const [key, entry] of Object.entries(fallback)) {
      const rawEntry = raw[key];
      result[key] = this.normalizeSlotMetaEntry(rawEntry, entry, true);
    }
    return result;
  }

  private mergeSlotPayoutMeta(
    raw: unknown,
    fallback: Record<string, SlotPayoutMetaEntry>,
  ): Record<string, SlotPayoutMetaEntry> {
    if (!isRecord(raw)) {
      return this.cloneSlotPayoutMeta(fallback);
    }
    const result: Record<string, SlotPayoutMetaEntry> = {};
    for (const [key, entry] of Object.entries(fallback)) {
      const rawEntry = raw[key];
      result[key] = this.normalizeSlotMetaEntry(rawEntry, entry, false);
    }
    return result;
  }

  private normalizeSlotMetaEntry(
    raw: unknown,
    fallback: SlotPayoutMetaEntry,
    strict: boolean,
  ) {
    if (!isRecord(raw)) {
      return { ...fallback };
    }
    const suggestWinPct = strict
      ? requireNumber(raw.suggestWinPct, 'suggestWinPct')
      : toNumber(raw.suggestWinPct, fallback.suggestWinPct);
    return {
      suggestWinPct,
      suggestWinPctDouble: toNumber(
        raw.suggestWinPctDouble,
        fallback.suggestWinPctDouble,
      ),
      suggestWinPctTriple: toNumber(
        raw.suggestWinPctTriple,
        fallback.suggestWinPctTriple,
      ),
      rtpFoolProofPct: strict
        ? requireNumber(raw.rtpFoolProofPct, 'rtpFoolProofPct')
        : toNumber(raw.rtpFoolProofPct, fallback.rtpFoolProofPct),
      totalCounts: strict
        ? requireNumber(raw.totalCounts, 'totalCounts')
        : toNumber(raw.totalCounts, fallback.totalCounts),
    };
  }

  private cloneSlotPayoutMeta(source: Record<string, SlotPayoutMetaEntry>) {
    const result: Record<string, SlotPayoutMetaEntry> = {};
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

  private extractBonusModeEnabledSource(raw: unknown): boolean {
    if (!isRecord(raw)) {
      return this.getDefaultConfig().bonusModeEnabled;
    }
    if (raw.bonusModeEnabled !== undefined) {
      return this.parseBonusModeEnabled(
        raw.bonusModeEnabled,
        this.getDefaultConfig().bonusModeEnabled,
      );
    }
    if (
      isRecord(raw.digitPayouts) &&
      raw.digitPayouts.bonusModeEnabled !== undefined
    ) {
      return this.parseBonusModeEnabled(
        raw.digitPayouts.bonusModeEnabled,
        this.getDefaultConfig().bonusModeEnabled,
      );
    }
    return this.getDefaultConfig().bonusModeEnabled;
  }

  private extractTokenValuesSource(raw: unknown): unknown {
    if (!isRecord(raw)) {
      return undefined;
    }
    if (raw.tokenValues !== undefined) {
      return raw.tokenValues;
    }
    if (
      isRecord(raw.digitPayouts) &&
      raw.digitPayouts.tokenValues !== undefined
    ) {
      return raw.digitPayouts.tokenValues;
    }
    return undefined;
  }

  private extractDigitBetAmountLimitsSource(raw: unknown): unknown {
    if (!isRecord(raw)) {
      return undefined;
    }
    if (raw.digitBetAmountLimits !== undefined) {
      return raw.digitBetAmountLimits;
    }
    if (
      isRecord(raw.digitPayouts) &&
      raw.digitPayouts.digitBetAmountLimits !== undefined
    ) {
      return raw.digitPayouts.digitBetAmountLimits;
    }
    return undefined;
  }

  private parseDigitBonusRatios(raw: unknown): DigitBonusRatios {
    const defaults = buildDefaultDigitBonusRatios();
    return this.mergeDigitBonusRatios(raw, defaults);
  }

  private parseTokenValues(raw: unknown, fallback: number[]): number[] {
    if (raw === undefined) {
      return fallback.slice();
    }
    if (!Array.isArray(raw) || raw.length !== fallback.length) {
      throw new BadRequestException(
        'tokenValues must be an array of 7 numbers',
      );
    }
    const values = raw.map((entry) => requireNumber(entry, 'tokenValues'));
    if (values.some((value) => value <= 0)) {
      throw new BadRequestException('tokenValues must be > 0');
    }
    return values;
  }

  private normalizeTokenValues(raw: unknown, fallback: number[]): number[] {
    if (!Array.isArray(raw) || raw.length !== fallback.length) {
      return fallback.slice();
    }
    const values = raw.map((entry) => Number(entry));
    if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
      return fallback.slice();
    }
    return values;
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
    const minBetAmount = Number(record.minBetAmount);
    const maxBetAmount = Number(record.maxBetAmount);
    const digitPayouts = this.mergeDigitPayouts(
      record.digitPayouts,
      defaults.digitPayouts,
    );
    const digitBetAmountLimits = this.mergeDigitBetAmountLimits(
      this.extractDigitBetAmountLimitsSource(record.digitPayouts),
      defaults.digitBetAmountLimits,
      minBetAmount,
      maxBetAmount,
    );
    const digitBonusRatios = this.mergeDigitBonusRatios(
      this.extractDigitBonusRatiosSource(record.digitPayouts),
      defaults.digitBonusRatios,
    );
    const bonusModeEnabled = this.parseBonusModeEnabled(
      this.extractBonusModeEnabledSource(record.digitPayouts),
      defaults.bonusModeEnabled,
    );
    const bonusSlotChanceTotal = toNumber(
      this.extractBonusSlotChanceTotalSource(record.digitPayouts),
      defaults.bonusSlotChanceTotal,
    );
    const tokenValues = this.normalizeTokenValues(
      this.extractTokenValuesSource(record.digitPayouts),
      defaults.tokenValues,
    );
    return {
      configVersion: record.updatedAt.toISOString(),
      bettingDurationMs: record.bettingDurationMs,
      resultDurationMs: record.resultDurationMs,
      resultDisplayDurationMs: record.resultDisplayDurationMs,
      minBetAmount,
      maxBetAmount,
      digitBetAmountLimits,
      tokenValues,
      payoutMultiplierUp: Number(record.payoutMultiplierUp),
      payoutMultiplierDown: Number(record.payoutMultiplierDown),
      priceSnapshotInterval: record.priceSnapshotInterval,
      bonusModeEnabled,
      bonusSlotChanceTotal,
      digitPayouts,
      digitBonusRatios,
    };
  }

  private toJsonDigitPayouts(
    payouts: DigitPayouts,
    digitBetAmountLimits: DigitBetAmountLimits,
    digitBonusRatios: DigitBonusRatios,
    bonusModeEnabled: boolean,
    bonusSlotChanceTotal?: number,
    tokenValues?: number[],
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
    const bySlotMeta: Record<string, SlotPayoutMetaEntry> = {};
    for (const [key, value] of Object.entries(payouts.bySlotMeta)) {
      bySlotMeta[key] = {
        suggestWinPct: value.suggestWinPct,
        suggestWinPctDouble: value.suggestWinPctDouble,
        suggestWinPctTriple: value.suggestWinPctTriple,
        rtpFoolProofPct: value.rtpFoolProofPct,
        totalCounts: value.totalCounts,
      };
    }
    const betAmountLimits: Record<string, BetAmountLimit> = {};
    for (const key of DIGIT_BET_LIMIT_RULE_KEYS) {
      betAmountLimits[key] = {
        minBetAmount: digitBetAmountLimits[key].minBetAmount,
        maxBetAmount: digitBetAmountLimits[key].maxBetAmount,
      };
    }

    return {
      smallBigOddEven: payouts.smallBigOddEven,
      anyTriple: payouts.anyTriple,
      double: payouts.double,
      triple: payouts.triple,
      digitBetAmountLimits: betAmountLimits,
      bonusModeEnabled,
      bonusSlotChanceTotal,
      tokenValues,
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
        config.digitBetAmountLimits,
        config.digitBonusRatios,
        config.bonusModeEnabled,
        config.bonusSlotChanceTotal,
        config.tokenValues,
      ),
    };
  }
}
