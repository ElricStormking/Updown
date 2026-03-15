import { DigitBetType } from '@prisma/client';
import type { GameConfigSnapshot } from '../config/game-config.defaults';
import {
  DEFAULT_BONUS_SLOT_CHANCE_TOTAL,
  buildDigitBetKey,
  getAllDigitBetSlots,
  pickBonusRatioWithChance,
} from './digit-bonus.utils';

const DEFAULT_SAMPLE_COUNT = 100_000;
const DEFAULT_SEED = 6;
const NO_BONUS_BUCKET_KEY = 'NO_BONUS';

type WeightedEntry = {
  ratio: number;
  weight: number;
};

type GroupedWeightedEntry = {
  ratio: number;
  weight: number;
};

type SlotMeta = {
  suggestWinPct: number;
  suggestWinPctDouble: number;
  suggestWinPctTriple: number;
  rtpFoolProofPct: number;
  totalCounts: number;
};

type SlotBaseRatios = {
  primary: number;
  secondary: number;
  tertiary: number;
};

export type BonusBucketValidationResult = {
  bucketKey: string;
  ratio: number | null;
  expectedProbability: number;
  expectedCount: number;
  observedCount: number;
  sigma: number;
  allowedDelta: number;
  zScore: number;
  pass: boolean;
};

export type BonusSlotRtpValidationResult = {
  slotKey: string;
  label: string;
  digitType: DigitBetType;
  selection: string | null;
  sampleCount: number;
  seed: number;
  runtimeRollTotal: number;
  configuredBaseWeight: number;
  displayTotalCounts: number;
  rtpTotalRoll: number;
  bonusWeightSum: number;
  baseRatios: SlotBaseRatios;
  expectedBonusHitPct: number;
  observedBonusHitPct: number;
  bonusHitSigmaPct: number;
  bonusHitAllowedDeltaPct: number;
  bonusHitZScore: number;
  expectedRtpPct: number;
  expectedRuntimeRtpPct: number;
  observedRtpPct: number;
  rtpStdError: number;
  rtpAllowedDelta: number;
  rtpZScore: number;
  rtpFoolProofPct: number | null;
  expectedExceedsRtpFoolProof: boolean;
  observedExceedsRtpFoolProof: boolean;
  bucketResults: BonusBucketValidationResult[];
  pass: boolean;
  failureReasons: string[];
};

export type BonusRtpValidationSummary = {
  sampleCount: number;
  seed: number;
  results: BonusSlotRtpValidationResult[];
  pass: boolean;
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const collectWeightedEntries = (ratios: number[], weights: number[]) => {
  if (!Array.isArray(ratios) || !Array.isArray(weights)) return [];
  const entries: WeightedEntry[] = [];
  const limit = Math.min(ratios.length, weights.length);
  for (let i = 0; i < limit; i += 1) {
    const ratio = Number(ratios[i]);
    const weight = Number(weights[i]);
    if (!Number.isFinite(ratio)) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    entries.push({ ratio, weight });
  }
  return entries;
};

const groupWeightedEntriesByRatio = (entries: WeightedEntry[]) => {
  const grouped = new Map<string, GroupedWeightedEntry>();
  for (const entry of entries) {
    const key = String(entry.ratio);
    const current = grouped.get(key);
    if (current) {
      current.weight += entry.weight;
      continue;
    }
    grouped.set(key, { ratio: entry.ratio, weight: entry.weight });
  }
  return Array.from(grouped.values()).sort((left, right) => left.ratio - right.ratio);
};

const createDeterministicRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const getRuntimeRollTotal = (config: GameConfigSnapshot) => {
  const rollTotal = Number(config.bonusSlotChanceTotal);
  if (Number.isFinite(rollTotal) && rollTotal > 0) {
    return rollTotal;
  }
  return DEFAULT_BONUS_SLOT_CHANCE_TOTAL;
};

const resolveSlot = (slotKey: string) => {
  const slot = getAllDigitBetSlots().find(
    (candidate) => buildDigitBetKey(candidate.digitType, candidate.selection) === slotKey,
  );
  if (!slot) {
    throw new Error(`Unknown digit bonus slot key: ${slotKey}`);
  }
  return slot;
};

const getSlotMeta = (config: GameConfigSnapshot, slotKey: string): SlotMeta => {
  const raw = config.digitPayouts.bySlotMeta[slotKey];
  return {
    suggestWinPct: toFiniteNumber(raw?.suggestWinPct),
    suggestWinPctDouble: toFiniteNumber(raw?.suggestWinPctDouble),
    suggestWinPctTriple: toFiniteNumber(raw?.suggestWinPctTriple),
    rtpFoolProofPct: toFiniteNumber(raw?.rtpFoolProofPct),
    totalCounts: toFiniteNumber(raw?.totalCounts),
  };
};

const getSlotBaseRatios = (
  config: GameConfigSnapshot,
  slotKey: string,
  digitType: DigitBetType,
  selection: string | null,
): SlotBaseRatios => {
  const primary =
    digitType === DigitBetType.SUM
      ? toFiniteNumber(config.digitPayouts.sum[Number(selection)])
      : toFiniteNumber(config.digitPayouts.bySlot[slotKey]);

  if (digitType !== DigitBetType.SINGLE) {
    return {
      primary,
      secondary: primary,
      tertiary: primary,
    };
  }

  return {
    primary,
    secondary: toFiniteNumber(config.digitPayouts.single.double),
    tertiary: toFiniteNumber(config.digitPayouts.single.triple),
  };
};

const computeAverageRatioWithBonus = (
  entries: WeightedEntry[],
  baseRatio: number,
  totalRoll: number,
) => {
  const safeTotalRoll =
    Number.isFinite(totalRoll) && totalRoll > 0 ? totalRoll : 0;
  const weightSum = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const baseCount = Math.max(safeTotalRoll - weightSum, 0);
  const bonusWeightedRatio = entries.reduce(
    (sum, entry) => sum + entry.ratio * entry.weight,
    0,
  );
  const baseWeightedRatio = (Number.isFinite(baseRatio) ? baseRatio : 0) * baseCount;
  const denominator = safeTotalRoll > 0 ? safeTotalRoll : baseCount;
  if (denominator <= 0) {
    return Number.isFinite(baseRatio) ? baseRatio : 0;
  }
  return (baseWeightedRatio + bonusWeightedRatio) / denominator;
};

const computeBonusRtpPercent = (
  entries: WeightedEntry[],
  suggestWinPct: number,
  baseRatio: number,
  totalRoll: number,
) => {
  if (!Number.isFinite(suggestWinPct)) return NaN;
  const avgRatio = computeAverageRatioWithBonus(entries, baseRatio, totalRoll);
  return suggestWinPct * (1 + avgRatio);
};

const getTrialRtpContribution = (
  digitType: DigitBetType,
  meta: SlotMeta,
  baseRatios: SlotBaseRatios,
  sampledRatio: number | null,
) => {
  if (digitType === DigitBetType.SINGLE) {
    const ratioPrimary = sampledRatio ?? baseRatios.primary;
    const ratioSecondary = sampledRatio ?? baseRatios.secondary;
    const ratioTertiary = sampledRatio ?? baseRatios.tertiary;
    return (
      meta.suggestWinPct * (1 + ratioPrimary) +
      meta.suggestWinPctDouble * (1 + ratioSecondary) +
      meta.suggestWinPctTriple * (1 + ratioTertiary)
    );
  }

  return meta.suggestWinPct * (1 + (sampledRatio ?? baseRatios.primary));
};

const getBucketProbability = (
  bucketWeight: number,
  totalWeight: number,
  runtimeRollTotal: number,
) => {
  if (bucketWeight <= 0 || totalWeight <= 0 || runtimeRollTotal <= 0) {
    return 0;
  }
  if (totalWeight <= runtimeRollTotal) {
    return bucketWeight / runtimeRollTotal;
  }
  return bucketWeight / totalWeight;
};

const getNoBonusProbability = (totalWeight: number, runtimeRollTotal: number) => {
  if (totalWeight <= 0) return 1;
  if (runtimeRollTotal <= 0) return 0;
  if (totalWeight >= runtimeRollTotal) return 0;
  return 1 - totalWeight / runtimeRollTotal;
};

const getExpectedCountWindow = (sampleCount: number, probability: number) => {
  const sigma = Math.sqrt(sampleCount * probability * (1 - probability));
  return {
    sigma,
    allowedDelta: 3 * sigma,
  };
};

const getZScore = (observed: number, expected: number, sigma: number) => {
  if (sigma <= 0) {
    return observed === expected ? 0 : Number.POSITIVE_INFINITY;
  }
  return (observed - expected) / sigma;
};

const formatSlotLabel = (digitType: DigitBetType, selection: string | null) =>
  selection ? `${digitType} ${selection}` : digitType;

const formatBucketLabel = (ratio: number | null) =>
  ratio === null ? 'no bonus' : `bonus ratio ${ratio}`;

export const simulateBonusSlotRtpValidation = (
  config: GameConfigSnapshot,
  slotKey: string,
  sampleCount = DEFAULT_SAMPLE_COUNT,
  seed = DEFAULT_SEED,
): BonusSlotRtpValidationResult => {
  const slot = resolveSlot(slotKey);
  const slotMeta = getSlotMeta(config, slotKey);
  const baseRatios = getSlotBaseRatios(
    config,
    slotKey,
    slot.digitType,
    slot.selection,
  );
  const runtimeRollTotal = getRuntimeRollTotal(config);
  const configuredBaseWeight =
    slotMeta.totalCounts > 0 ? slotMeta.totalCounts : runtimeRollTotal;

  const ratioConfig = config.digitBonusRatios[slotKey] ?? {
    ratios: [],
    weights: [],
  };
  const weightedEntries = collectWeightedEntries(
    ratioConfig.ratios,
    ratioConfig.weights,
  );
  const groupedEntries = groupWeightedEntriesByRatio(weightedEntries);
  const bonusWeightSum = weightedEntries.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );
  const displayTotalCounts = configuredBaseWeight + bonusWeightSum;
  const rtpTotalRoll = displayTotalCounts > 0 ? displayTotalCounts : runtimeRollTotal;

  const expectedRtpPct =
    slot.digitType === DigitBetType.SINGLE
      ? computeBonusRtpPercent(
          weightedEntries,
          slotMeta.suggestWinPct,
          baseRatios.primary,
          rtpTotalRoll,
        ) +
        computeBonusRtpPercent(
          weightedEntries,
          slotMeta.suggestWinPctDouble,
          baseRatios.secondary,
          rtpTotalRoll,
        ) +
        computeBonusRtpPercent(
          weightedEntries,
          slotMeta.suggestWinPctTriple,
          baseRatios.tertiary,
          rtpTotalRoll,
        )
      : computeBonusRtpPercent(
          weightedEntries,
          slotMeta.suggestWinPct,
          baseRatios.primary,
          rtpTotalRoll,
        );

  const noBonusProbability = getNoBonusProbability(
    bonusWeightSum,
    runtimeRollTotal,
  );
  const expectedRuntimeRtpPct =
    noBonusProbability *
      getTrialRtpContribution(
        slot.digitType,
        slotMeta,
        baseRatios,
        null,
      ) +
    groupedEntries.reduce(
      (sum, entry) =>
        sum +
        getBucketProbability(entry.weight, bonusWeightSum, runtimeRollTotal) *
          getTrialRtpContribution(
            slot.digitType,
            slotMeta,
            baseRatios,
            entry.ratio,
          ),
      0,
    );

  const observedCounts = new Map<string, number>();
  observedCounts.set(NO_BONUS_BUCKET_KEY, 0);
  groupedEntries.forEach((entry) => {
    observedCounts.set(String(entry.ratio), 0);
  });

  const rng = createDeterministicRng(seed);
  let observedBonusHitCount = 0;
  let mean = 0;
  let m2 = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const sampledRatio = pickBonusRatioWithChance(
      ratioConfig.ratios,
      ratioConfig.weights,
      rng,
      runtimeRollTotal,
    );

    const bucketKey = sampledRatio === null ? NO_BONUS_BUCKET_KEY : String(sampledRatio);
    observedCounts.set(bucketKey, (observedCounts.get(bucketKey) ?? 0) + 1);
    if (sampledRatio !== null) {
      observedBonusHitCount += 1;
    }

    const contribution = getTrialRtpContribution(
      slot.digitType,
      slotMeta,
      baseRatios,
      sampledRatio,
    );
    const delta = contribution - mean;
    mean += delta / (index + 1);
    m2 += delta * (contribution - mean);
  }

  const bucketResults: BonusBucketValidationResult[] = [];
  const noBonusWindow = getExpectedCountWindow(sampleCount, noBonusProbability);
  const expectedNoBonusCount = sampleCount * noBonusProbability;
  const observedNoBonusCount = observedCounts.get(NO_BONUS_BUCKET_KEY) ?? 0;
  bucketResults.push({
    bucketKey: NO_BONUS_BUCKET_KEY,
    ratio: null,
    expectedProbability: noBonusProbability,
    expectedCount: expectedNoBonusCount,
    observedCount: observedNoBonusCount,
    sigma: noBonusWindow.sigma,
    allowedDelta: noBonusWindow.allowedDelta,
    zScore: getZScore(
      observedNoBonusCount,
      expectedNoBonusCount,
      noBonusWindow.sigma,
    ),
    pass:
      Math.abs(observedNoBonusCount - expectedNoBonusCount) <=
      noBonusWindow.allowedDelta,
  });

  groupedEntries.forEach((entry) => {
    const probability = getBucketProbability(
      entry.weight,
      bonusWeightSum,
      runtimeRollTotal,
    );
    const expectedCount = sampleCount * probability;
    const observedCount = observedCounts.get(String(entry.ratio)) ?? 0;
    const window = getExpectedCountWindow(sampleCount, probability);
    bucketResults.push({
      bucketKey: String(entry.ratio),
      ratio: entry.ratio,
      expectedProbability: probability,
      expectedCount,
      observedCount,
      sigma: window.sigma,
      allowedDelta: window.allowedDelta,
      zScore: getZScore(observedCount, expectedCount, window.sigma),
      pass: Math.abs(observedCount - expectedCount) <= window.allowedDelta,
    });
  });

  const expectedBonusHitProbability =
    sampleCount > 0 ? 1 - noBonusProbability : 0;
  const observedBonusHitPct = (observedBonusHitCount / sampleCount) * 100;
  const expectedBonusHitPct = expectedBonusHitProbability * 100;
  const bonusHitSigmaPct =
    Math.sqrt(
      sampleCount *
        expectedBonusHitProbability *
        (1 - expectedBonusHitProbability),
    ) /
    sampleCount *
    100;
  const bonusHitAllowedDeltaPct = 3 * bonusHitSigmaPct;
  const bonusHitZScore = getZScore(
    observedBonusHitCount,
    sampleCount * expectedBonusHitProbability,
    (bonusHitSigmaPct / 100) * sampleCount,
  );

  const sampleVariance = sampleCount > 1 ? m2 / (sampleCount - 1) : 0;
  const rtpStdError =
    sampleCount > 0 ? Math.sqrt(sampleVariance / sampleCount) : 0;
  const rtpAllowedDelta = 3 * rtpStdError;
  const rtpZScore = getZScore(mean, expectedRtpPct, rtpStdError);
  const rtpFoolProofPct =
    slotMeta.rtpFoolProofPct > 0 ? slotMeta.rtpFoolProofPct : null;
  const expectedExceedsRtpFoolProof =
    rtpFoolProofPct !== null && expectedRtpPct > rtpFoolProofPct;
  const observedExceedsRtpFoolProof =
    rtpFoolProofPct !== null && mean > rtpFoolProofPct;

  const failureReasons: string[] = [];
  bucketResults
    .filter((result) => !result.pass)
    .forEach((result) => {
      failureReasons.push(
        `${formatBucketLabel(result.ratio)} count ${result.observedCount} ` +
          `outside expected ${result.expectedCount.toFixed(2)} +/- ` +
          `${result.allowedDelta.toFixed(2)}`,
      );
    });

  if (Math.abs(observedBonusHitPct - expectedBonusHitPct) > bonusHitAllowedDeltaPct) {
    failureReasons.push(
      `bonus hit % ${observedBonusHitPct.toFixed(4)} outside expected ` +
        `${expectedBonusHitPct.toFixed(4)} +/- ${bonusHitAllowedDeltaPct.toFixed(4)}`,
    );
  }

  if (Math.abs(mean - expectedRtpPct) > rtpAllowedDelta) {
    failureReasons.push(
      `RTP % ${mean.toFixed(6)} outside admin expected ${expectedRtpPct.toFixed(6)} +/- ` +
        `${rtpAllowedDelta.toFixed(6)}`,
    );
  }

  if (expectedExceedsRtpFoolProof) {
    failureReasons.push(
      `admin expected RTP ${expectedRtpPct.toFixed(6)} exceeds RTP FP ${rtpFoolProofPct?.toFixed(6)}`,
    );
  }

  if (observedExceedsRtpFoolProof) {
    failureReasons.push(
      `observed RTP ${mean.toFixed(6)} exceeds RTP FP ${rtpFoolProofPct?.toFixed(6)}`,
    );
  }

  return {
    slotKey,
    label: formatSlotLabel(slot.digitType, slot.selection),
    digitType: slot.digitType,
    selection: slot.selection,
    sampleCount,
    seed,
    runtimeRollTotal,
    configuredBaseWeight,
    displayTotalCounts,
    rtpTotalRoll,
    bonusWeightSum,
    baseRatios,
    expectedBonusHitPct,
    observedBonusHitPct,
    bonusHitSigmaPct,
    bonusHitAllowedDeltaPct,
    bonusHitZScore,
    expectedRtpPct,
    expectedRuntimeRtpPct,
    observedRtpPct: mean,
    rtpStdError,
    rtpAllowedDelta,
    rtpZScore,
    rtpFoolProofPct,
    expectedExceedsRtpFoolProof,
    observedExceedsRtpFoolProof,
    bucketResults,
    pass: failureReasons.length === 0,
    failureReasons,
  };
};

export const simulateAllBonusSlotRtpValidations = (
  config: GameConfigSnapshot,
  sampleCount = DEFAULT_SAMPLE_COUNT,
  seed = DEFAULT_SEED,
): BonusRtpValidationSummary => {
  const results = getAllDigitBetSlots().map((slot, index) =>
    simulateBonusSlotRtpValidation(
      config,
      buildDigitBetKey(slot.digitType, slot.selection),
      sampleCount,
      seed + index,
    ),
  );
  return {
    sampleCount,
    seed,
    results,
    pass: results.every((result) => result.pass),
  };
};

export const formatBonusSlotRtpValidationFailure = (
  result: BonusSlotRtpValidationResult,
) => {
  const bucketLines = result.bucketResults.map((bucket) => {
    const probabilityPct = bucket.expectedProbability * 100;
    return (
      `  - ${formatBucketLabel(bucket.ratio)}: observed=${bucket.observedCount}, ` +
      `expected=${bucket.expectedCount.toFixed(2)}, expectedPct=${probabilityPct.toFixed(4)}%, ` +
      `3sigma=${bucket.allowedDelta.toFixed(2)}, z=${bucket.zScore.toFixed(3)}`
    );
  });

  return [
    `${result.label} [${result.slotKey}] failed bonus RTP validation`,
    `  runtimeRollTotal=${result.runtimeRollTotal}, configuredBaseWeight=${result.configuredBaseWeight}, ` +
      `displayTotalCounts=${result.displayTotalCounts}, adminRtpTotalRoll=${result.rtpTotalRoll}, ` +
      `bonusWeightSum=${result.bonusWeightSum}`,
    `  adminExpectedRtp=${result.expectedRtpPct.toFixed(6)}%, ` +
      `runtimeExpectedRtp=${result.expectedRuntimeRtpPct.toFixed(6)}%, ` +
      `observedRtp=${result.observedRtpPct.toFixed(6)}%, ` +
      `3sigma=${result.rtpAllowedDelta.toFixed(6)}, z=${result.rtpZScore.toFixed(3)}`,
    `  expectedBonusHit=${result.expectedBonusHitPct.toFixed(4)}%, ` +
      `observedBonusHit=${result.observedBonusHitPct.toFixed(4)}%, ` +
      `3sigma=${result.bonusHitAllowedDeltaPct.toFixed(4)}, z=${result.bonusHitZScore.toFixed(3)}`,
    `  rtpFoolProofPct=${result.rtpFoolProofPct?.toFixed(6) ?? '--'}, ` +
      `expectedExceeds=${result.expectedExceedsRtpFoolProof}, observedExceeds=${result.observedExceedsRtpFoolProof}`,
    `  failureReasons=${result.failureReasons.join(' | ')}`,
    `  buckets:`,
    ...bucketLines,
  ].join('\n');
};

export const bonusRtpSimulationDefaults = {
  sampleCount: DEFAULT_SAMPLE_COUNT,
  seed: DEFAULT_SEED,
};
