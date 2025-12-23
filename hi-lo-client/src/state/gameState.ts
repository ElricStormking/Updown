import type {
  BetHistoryItem,
  BetSide,
  GameConfig,
  RoundHistoryItem,
  RoundStatePayload,
} from '../types';

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
}

const listeners = new Set<(state: GameState) => void>();

export const state: GameState = {
  walletBalance: 0,
  betAmount: 10,
  selectedSide: 'UP',
  betHistory: [],
  roundHistory: [],
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

