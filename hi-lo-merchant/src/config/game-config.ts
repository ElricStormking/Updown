export const gameConfig = {
  bettingDurationMs: 20000,
  resultDurationMs: 35000,
  resultDisplayDurationMs: 10000,
  minBetAmount: 1,
  maxBetAmount: 5000,
  tokenValues: [10, 50, 100, 150, 200, 300, 500],
  payoutMultiplierUp: 1.95,
  payoutMultiplierDown: 1.95,
  priceSnapshotInterval: 5000,
  digitBonus: {
    enabled: true,
    payoutFactor: 1.2,
  },
} as const;
