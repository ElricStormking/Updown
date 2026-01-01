import type {
  BetHistoryItem,
  BetSide,
  DigitBetType,
  GameConfig,
  RoundResultPayload,
  RoundHistoryItem,
  RoundStatePayload,
} from '../types';

export interface DigitSelection {
  roundId: number;
  digitType: DigitBetType;
  selection: string | null;
}

export interface TokenPlacement {
  value: number;
  count: number;
}

export interface GameState {
  token?: string;
  user?: {
    id: string;
    account: string;
  };
  walletBalance: number;
  selectedTokenValue: number;
  selectedSide: BetSide;
  tokenPlacements: Record<string, TokenPlacement>;
  config?: GameConfig;
  betHistory: BetHistoryItem[];
  roundHistory: RoundHistoryItem[];
  currentRound?: RoundStatePayload;
  digitSelections: DigitSelection[];
  lastRoundResult: RoundResultPayload | null;
  lastRoundStake: number;
  lastRoundPayout: number;
  lastDigitResult: string | null;
  lastDigitSum: number | null;
}

const listeners = new Set<(state: GameState) => void>();

export const state: GameState = {
  walletBalance: 0,
  selectedTokenValue: 10,
  selectedSide: 'UP',
  tokenPlacements: {},
  betHistory: [],
  roundHistory: [],
  digitSelections: [],
  lastRoundResult: null,
  lastRoundStake: 0,
  lastRoundPayout: 0,
  lastDigitResult: null,
  lastDigitSum: null,
};

export const subscribe = (listener: (state: GameState) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const notify = () => {
  listeners.forEach((listener) => listener(state));
};

export const updateState = (partial: Partial<GameState>) => {
  Object.assign(state, partial);
  notify();
};
