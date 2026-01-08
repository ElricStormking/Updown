export type BetSide = 'UP' | 'DOWN';
export type BetType = 'HILO' | 'DIGIT';
export type DigitBetType =
  | 'SMALL'
  | 'BIG'
  | 'ODD'
  | 'EVEN'
  | 'ANY_TRIPLE'
  | 'DOUBLE'
  | 'TRIPLE'
  | 'SUM'
  | 'SINGLE';

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
  digitResult: string | null;
  digitSum: number | null;
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
    account: string;
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
  resultDisplayDurationMs: number;
  minBetAmount: number;
  maxBetAmount: number;
  payoutMultiplierUp: number;
  payoutMultiplierDown: number;
  historyLimits: {
    player: number;
    rounds: number;
  };
  digitPayouts: {
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
    ranges: {
      small: { min: number; max: number };
      big: { min: number; max: number };
      sumMin: number;
      sumMax: number;
    };
  };
}

export interface BetHistoryItem {
  id: string;
  roundId: number;
  betType: BetType;
  side: BetSide | null;
  digitType: DigitBetType | null;
  selection: string | null;
  amount: number;
  odds: number;
  result: 'PENDING' | 'WIN' | 'LOSE' | 'REFUND';
  payout: number;
  createdAt: string;
  lockedPrice: number | null;
  finalPrice: number | null;
  winningSide: BetSide | null;
  digitResult: string | null;
  digitSum: number | null;
}

export interface BetHistoryPageResponse {
  page: number;
  limit: number;
  hasNext: boolean;
  items: BetHistoryItem[];
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
  digitResult: string | null;
  digitSum: number | null;
  oddsUp: number;
  oddsDown: number;
}

export interface RoundUserSettlementPayload {
  roundId: number;
  totals: {
    stake: number;
    payout: number;
    net: number;
  };
  bets: BetHistoryItem[];
}
