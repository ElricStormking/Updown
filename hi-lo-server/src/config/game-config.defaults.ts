import { DigitBetType } from '@prisma/client';
import { DIGIT_PAYOUTS } from '../game/digit-bet.constants';
import {
  DEFAULT_BONUS_SLOT_CHANCE_TOTAL,
  buildDigitBonusKey,
  getAllDigitBetSlots,
} from '../game/digit-bonus.utils';
import { gameConfig } from './game-config';

export interface DigitPayouts {
  smallBigOddEven: number;
  anyTriple: number;
  double: number;
  triple: number;
  single: {
    single: number;
    double: number;
    triple: number;
  };
  sum: Record<number, number>;
  bySlot: Record<string, number>;
  bySlotMeta: Record<
    string,
    {
      suggestWinPct: number;
      suggestWinPctDouble: number;
      suggestWinPctTriple: number;
      rtpFoolProofPct: number;
      totalCounts: number;
    }
  >;
}

export type BetAmountLimit = {
  minBetAmount: number;
  maxBetAmount: number;
};

export type DigitBetAmountLimits = {
  smallBig: BetAmountLimit;
  oddEven: BetAmountLimit;
  double: BetAmountLimit;
  triple: BetAmountLimit;
  sum: BetAmountLimit;
  single: BetAmountLimit;
  anyTriple: BetAmountLimit;
};

export type DigitBonusRatioEntry = {
  ratios: number[];
  weights: number[];
};

export type DigitBonusRatios = Record<string, DigitBonusRatioEntry>;

export interface GameConfigSnapshot {
  configVersion?: string;
  bettingDurationMs: number;
  resultDurationMs: number;
  resultDisplayDurationMs: number;
  minBetAmount: number;
  maxBetAmount: number;
  digitBetAmountLimits: DigitBetAmountLimits;
  tokenValues: number[];
  payoutMultiplierUp: number;
  payoutMultiplierDown: number;
  priceSnapshotInterval: number;
  bonusModeEnabled: boolean;
  bonusSlotChanceTotal: number;
  digitPayouts: DigitPayouts;
  digitBonusRatios: DigitBonusRatios;
}

const buildDefaultDigitBetAmountLimits = (
  minBetAmount: number,
  maxBetAmount: number,
): DigitBetAmountLimits => ({
  smallBig: { minBetAmount, maxBetAmount },
  oddEven: { minBetAmount, maxBetAmount },
  double: { minBetAmount, maxBetAmount },
  triple: { minBetAmount, maxBetAmount },
  sum: { minBetAmount, maxBetAmount },
  single: { minBetAmount, maxBetAmount },
  anyTriple: { minBetAmount, maxBetAmount },
});

const buildSumPayouts = () => {
  const sum: Record<number, number> = {};
  for (const [key, value] of Object.entries(DIGIT_PAYOUTS.sum)) {
    sum[Number(key)] = value;
  }
  return sum;
};

const buildDefaultSlotPayouts = () => {
  const payouts: Record<string, number> = {};
  getAllDigitBetSlots().forEach((slot) => {
    if (slot.digitType === DigitBetType.SUM) return;
    let value: number = DIGIT_PAYOUTS.smallBigOddEven;
    switch (slot.digitType) {
      case DigitBetType.ANY_TRIPLE:
        value = DIGIT_PAYOUTS.anyTriple;
        break;
      case DigitBetType.DOUBLE:
        value = DIGIT_PAYOUTS.double;
        break;
      case DigitBetType.TRIPLE:
        value = DIGIT_PAYOUTS.triple;
        break;
      case DigitBetType.SINGLE:
        value = DIGIT_PAYOUTS.single.single;
        break;
      case DigitBetType.SMALL:
      case DigitBetType.ODD:
      case DigitBetType.EVEN:
      case DigitBetType.BIG:
      default:
        value = DIGIT_PAYOUTS.smallBigOddEven;
        break;
    }
    payouts[buildDigitBonusKey(slot)] = value;
  });
  return payouts;
};

const computeDigitSumSuggestWinPct = (selection: string | null) => {
  const sum = Number(selection);
  if (!Number.isFinite(sum)) return 0;
  let count = 0;
  for (let a = 0; a <= 9; a += 1) {
    for (let b = 0; b <= 9; b += 1) {
      const c = sum - a - b;
      if (c >= 0 && c <= 9) count += 1;
    }
  }
  return (count / 1000) * 100;
};

const getDefaultSuggestWinPct = (
  digitType: DigitBetType,
  selection: string | null,
) => {
  switch (digitType) {
    case DigitBetType.SMALL:
    case DigitBetType.BIG:
      return 49.5;
    case DigitBetType.ODD:
    case DigitBetType.EVEN:
      return 49.5;
    case DigitBetType.ANY_TRIPLE:
      return 1;
    case DigitBetType.DOUBLE:
      return 2.7;
    case DigitBetType.TRIPLE:
      return 0.1;
    case DigitBetType.SINGLE:
      return 27.1;
    case DigitBetType.SUM:
      return computeDigitSumSuggestWinPct(selection);
    default:
      return 0;
  }
};

const buildDefaultSlotPayoutMeta = () => {
  const meta: Record<
    string,
    {
      suggestWinPct: number;
      suggestWinPctDouble: number;
      suggestWinPctTriple: number;
      rtpFoolProofPct: number;
      totalCounts: number;
    }
  > = {};
  getAllDigitBetSlots().forEach((slot) => {
    const suggestWinPct = getDefaultSuggestWinPct(
      slot.digitType,
      slot.selection,
    );
    meta[buildDigitBonusKey(slot)] = {
      suggestWinPct,
      suggestWinPctDouble: 0,
      suggestWinPctTriple: 0,
      rtpFoolProofPct: 0,
      totalCounts: 100000,
    };
  });
  return meta;
};

export const buildDefaultDigitPayouts = (): DigitPayouts => ({
  smallBigOddEven: DIGIT_PAYOUTS.smallBigOddEven,
  anyTriple: DIGIT_PAYOUTS.anyTriple,
  double: DIGIT_PAYOUTS.double,
  triple: DIGIT_PAYOUTS.triple,
  single: {
    single: DIGIT_PAYOUTS.single.single,
    double: DIGIT_PAYOUTS.single.double,
    triple: DIGIT_PAYOUTS.single.triple,
  },
  sum: buildSumPayouts(),
  bySlot: buildDefaultSlotPayouts(),
  bySlotMeta: buildDefaultSlotPayoutMeta(),
});

export const buildDefaultDigitBonusRatios = (): DigitBonusRatios => {
  const slots = getAllDigitBetSlots();
  const ratios: DigitBonusRatios = {};
  slots.forEach((slot) => {
    const key = buildDigitBonusKey(slot);
    ratios[key] = {
      ratios: [0, 0, 0, 0, 0],
      weights: [0, 0, 0, 0, 0],
    };
  });

  const setDefaults = (
    keys: string[],
    bonusRatios: number[],
    bonusWeights: number[],
  ) => {
    keys.forEach((key) => {
      ratios[key] = {
        ratios: bonusRatios.slice(),
        weights: bonusWeights.slice(),
      };
    });
  };

  const byType = (digitType: DigitBetType) =>
    slots
      .filter((slot) => slot.digitType === digitType)
      .map((slot) => buildDigitBonusKey(slot));

  setDefaults(
    [
      buildDigitBonusKey({
        digitType: DigitBetType.ANY_TRIPLE,
        selection: null,
      }),
    ],
    [100, 168, 200, 300, 500],
    [3300, 3000, 2700, 2600, 2500],
  );

  setDefaults(
    byType(DigitBetType.DOUBLE),
    [50, 88, 100, 128, 168],
    [3519, 2037, 1852, 1852, 1852],
  );
  setDefaults(
    byType(DigitBetType.TRIPLE),
    [888, 1000, 1500, 2000, 2500],
    [5000, 5000, 5000, 5000, 5000],
  );
  setDefaults(
    byType(DigitBetType.SINGLE),
    [50, 68, 88, 100, 128],
    [100, 100, 100, 100, 50],
  );

  const sumDefaults: Record<number, { ratios: number[]; weights: number[] }> = {
    1: {
      ratios: [300, 500, 777, 888, 1000],
      weights: [4000, 4000, 3667, 3667, 3667],
    },
    2: {
      ratios: [200, 388, 500, 666, 1000],
      weights: [2167, 2000, 2000, 2000, 1833],
    },
    3: {
      ratios: [88, 200, 388, 666, 888],
      weights: [1500, 1500, 1500, 1500, 1400],
    },
    4: {
      ratios: [88, 168, 200, 300, 500],
      weights: [2000, 2000, 2000, 1667, 1667],
    },
    5: {
      ratios: [50, 88, 168, 300, 500],
      weights: [1190, 1190, 1190, 1190, 1190],
    },
    6: { ratios: [50, 88, 168, 300, 500], weights: [821, 821, 821, 821, 821] },
    7: { ratios: [50, 88, 168, 200, 250], weights: [917, 917, 917, 917, 917] },
    8: { ratios: [50, 88, 168, 200, 250], weights: [667, 667, 667, 667, 667] },
    9: {
      ratios: [25, 50, 88, 128, 168],
      weights: [1000, 1000, 1000, 1000, 1000],
    },
    10: {
      ratios: [25, 50, 88, 128, 168],
      weights: [1063, 1063, 1063, 1063, 1063],
    },
    11: { ratios: [25, 50, 88, 128, 168], weights: [971, 971, 971, 971, 971] },
    12: {
      ratios: [20, 30, 50, 68, 88],
      weights: [1233, 1233, 1233, 1233, 1233],
    },
    13: {
      ratios: [20, 30, 50, 68, 88],
      weights: [1333, 1333, 1333, 1333, 1333],
    },
    14: {
      ratios: [20, 30, 50, 68, 88],
      weights: [1333, 1333, 1333, 1333, 1333],
    },
    15: {
      ratios: [20, 30, 50, 68, 88],
      weights: [1233, 1233, 1233, 1233, 1233],
    },
    16: { ratios: [25, 50, 88, 128, 168], weights: [971, 971, 971, 971, 971] },
    17: {
      ratios: [25, 50, 88, 128, 168],
      weights: [1063, 1063, 1063, 1063, 1063],
    },
    18: {
      ratios: [25, 50, 88, 128, 168],
      weights: [1000, 1000, 1000, 1000, 1000],
    },
    19: { ratios: [50, 88, 168, 200, 250], weights: [667, 667, 667, 667, 667] },
    20: { ratios: [50, 88, 168, 200, 250], weights: [917, 917, 917, 917, 917] },
    21: { ratios: [50, 88, 168, 300, 500], weights: [821, 821, 821, 821, 821] },
    22: {
      ratios: [50, 88, 168, 300, 500],
      weights: [1190, 1190, 1190, 1190, 1190],
    },
    23: {
      ratios: [88, 168, 200, 300, 500],
      weights: [2000, 2000, 2000, 1667, 1667],
    },
    24: {
      ratios: [88, 200, 388, 666, 888],
      weights: [1500, 1500, 1500, 1500, 1400],
    },
    25: {
      ratios: [200, 388, 500, 666, 1000],
      weights: [2167, 2000, 2000, 2000, 1833],
    },
    26: {
      ratios: [300, 500, 777, 888, 1000],
      weights: [4000, 4000, 3667, 3667, 3667],
    },
    27: {
      ratios: [300, 500, 777, 888, 1000],
      weights: [4000, 4000, 3667, 3667, 3667],
    },
  };

  slots
    .filter((slot) => slot.digitType === DigitBetType.SUM && slot.selection)
    .forEach((slot) => {
      const sumKey = Number(slot.selection);
      if (!Number.isFinite(sumKey)) return;
      const entry = sumDefaults[sumKey];
      if (!entry) return;
      ratios[buildDigitBonusKey(slot)] = {
        ratios: entry.ratios.slice(),
        weights: entry.weights.slice(),
      };
    });

  return ratios;
};

export const buildDefaultGameConfig = (): GameConfigSnapshot => ({
  configVersion: 'default',
  bettingDurationMs: Number(gameConfig.bettingDurationMs),
  resultDurationMs: Number(gameConfig.resultDurationMs),
  resultDisplayDurationMs: Number(gameConfig.resultDisplayDurationMs),
  minBetAmount: Number(gameConfig.minBetAmount),
  maxBetAmount: Number(gameConfig.maxBetAmount),
  digitBetAmountLimits: buildDefaultDigitBetAmountLimits(
    Number(gameConfig.minBetAmount),
    Number(gameConfig.maxBetAmount),
  ),
  tokenValues: Array.isArray(gameConfig.tokenValues)
    ? gameConfig.tokenValues.slice()
    : [10, 50, 100, 150, 200, 300, 500],
  payoutMultiplierUp: Number(gameConfig.payoutMultiplierUp),
  payoutMultiplierDown: Number(gameConfig.payoutMultiplierDown),
  priceSnapshotInterval: Number(gameConfig.priceSnapshotInterval),
  bonusModeEnabled: Boolean(gameConfig.digitBonus?.enabled),
  bonusSlotChanceTotal: DEFAULT_BONUS_SLOT_CHANCE_TOTAL,
  digitPayouts: buildDefaultDigitPayouts(),
  digitBonusRatios: buildDefaultDigitBonusRatios(),
});
