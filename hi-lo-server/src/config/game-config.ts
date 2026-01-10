export const gameConfig = {
  bettingDurationMs: 15000,
  resultDurationMs: 10000,
  resultDisplayDurationMs: 5000,
  minBetAmount: 1,
  maxBetAmount: 1000,
  payoutMultiplierUp: 1.95,
  payoutMultiplierDown: 1.95,
  priceSnapshotInterval: 5000,
  digitBonus: {
    enabled: true,
    minSlots: 1,
    maxSlots: 3,
    payoutFactor: 1.2,
  },
} as const;
