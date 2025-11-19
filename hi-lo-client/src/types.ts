export type BetSide = 'UP' | 'DOWN';

export interface PriceUpdate {
  price: number;
  timestamp: number;
}

export interface RoundStatePayload {
  id: number;
  status: 'BETTING' | 'RESULT_PENDING' | 'COMPLETED' | 'PENDING';
  startTime: string;
  lockTime: string;
  endTime: string;
  oddsUp: number;
  oddsDown: number;
  lockedPrice?: number | null;
  finalPrice?: number | null;
  winningSide?: BetSide | null;
}

export interface RoundLockPayload {
  roundId: number;
  lockedPrice: number | null;
}

export interface RoundResultPayload {
  roundId: number;
  lockedPrice: number | null;
  finalPrice: number | null;
  winningSide: BetSide | null;
  stats: {
    totalBets: number;
    winners: number;
    refunded: number;
    totalVolume: number;
  };
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
}

export interface WalletResponse {
  id: string;
  balance: string;
  currency: string;
}

export interface GameConfig {
  bettingDurationMs: number;
  resultDurationMs: number;
  minBetAmount: number;
  maxBetAmount: number;
  payoutMultiplierUp: number;
  payoutMultiplierDown: number;
  historyLimits: {
    player: number;
    rounds: number;
  };
}

export interface BetHistoryItem {
  id: string;
  roundId: number;
  side: BetSide;
  amount: number;
  odds: number;
  result: 'PENDING' | 'WIN' | 'LOSE' | 'REFUND';
  payout: number;
  createdAt: string;
  lockedPrice: number | null;
  finalPrice: number | null;
  winningSide: BetSide | null;
}

export interface RoundHistoryItem {
  id: number;
  status: 'BETTING' | 'RESULT_PENDING' | 'COMPLETED' | 'PENDING';
  startTime: string;
  lockTime: string;
  endTime: string;
  lockedPrice: number | null;
  finalPrice: number | null;
  winningSide: BetSide | null;
  oddsUp: number;
  oddsDown: number;
}

