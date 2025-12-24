import type {
  BetHistoryItem,
  BetSide,
  DigitBetType,
  GameConfig,
  RoundHistoryItem,
  RoundStatePayload,
} from '../types';

export interface DigitSelection {
  roundId: number;
  digitType: DigitBetType;
  selection: string | null;
}

export interface GameState {
  token?: string;
  user?: {
    id: string;
    account: string;
  };
  walletBalance: number;
  betAmount: number;
  selectedSide: BetSide;
  config?: GameConfig;
  betHistory: BetHistoryItem[];
  roundHistory: RoundHistoryItem[];
  currentRound?: RoundStatePayload;
  digitSelections: DigitSelection[];
  lastDigitResult: string | null;
  lastDigitSum: number | null;
}

const listeners = new Set<(state: GameState) => void>();

export const state: GameState = {
  walletBalance: 0,
  betAmount: 10,
  selectedSide: 'UP',
  betHistory: [],
  roundHistory: [],
  digitSelections: [],
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
