import { DIGIT_PAYOUTS } from '../game/digit-bet.constants';
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
}

export interface GameConfigSnapshot {
  configVersion?: string;
  bettingDurationMs: number;
  resultDurationMs: number;
  resultDisplayDurationMs: number;
  minBetAmount: number;
  maxBetAmount: number;
  payoutMultiplierUp: number;
  payoutMultiplierDown: number;
  priceSnapshotInterval: number;
  digitPayouts: DigitPayouts;
}

const buildSumPayouts = () => {
  const sum: Record<number, number> = {};
  for (const [key, value] of Object.entries(DIGIT_PAYOUTS.sum)) {
    sum[Number(key)] = value;
  }
  return sum;
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
});

export const buildDefaultGameConfig = (): GameConfigSnapshot => ({
  configVersion: 'default',
  bettingDurationMs: Number(gameConfig.bettingDurationMs),
  resultDurationMs: Number(gameConfig.resultDurationMs),
  resultDisplayDurationMs: Number(gameConfig.resultDisplayDurationMs),
  minBetAmount: Number(gameConfig.minBetAmount),
  maxBetAmount: Number(gameConfig.maxBetAmount),
  payoutMultiplierUp: Number(gameConfig.payoutMultiplierUp),
  payoutMultiplierDown: Number(gameConfig.payoutMultiplierDown),
  priceSnapshotInterval: Number(gameConfig.priceSnapshotInterval),
  digitPayouts: buildDefaultDigitPayouts(),
});
