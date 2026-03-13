export const CacheKeys = {
  btcPrice: 'btc:currentPrice',
  activeRoundState: 'game:round:active',
  activeRoundFinalization: 'game:round:active:finalization',
  roundState: (roundId: number | string) => `game:round:${roundId}`,
  betQueue(roundId: number | string) {
    return `game:round:${roundId}:bets`;
  },
} as const;
