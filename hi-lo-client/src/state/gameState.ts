import type {
  BetHistoryItem,
  BetSide,
  DigitBetType,
  GameConfig,
  RoundResultPayload,
  RoundHistoryItem,
  RoundStatePayload,
} from '../types';
import { getInitialLanguage, type LanguageCode } from '../i18n';

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
  merchantId?: string;
  language: LanguageCode;
  walletBalance: number;
  selectedTokenValue: number;
  selectedSide: BetSide;
  tokenPlacements: Record<string, TokenPlacement>;
  config?: GameConfig;
  betHistory: BetHistoryItem[];
  betHistoryPage: number;
  betHistoryPageSize: number;
  betHistoryPageHasNext: boolean;
  betHistoryPageItems: BetHistoryItem[];
  roundHistory: RoundHistoryItem[];
  currentRound?: RoundStatePayload;
  digitSelections: DigitSelection[];
  lastRoundResult: RoundResultPayload | null;
  lastRoundStake: number;
  lastRoundPayout: number;
  lastRoundBets: BetHistoryItem[];
  lastDigitResult: string | null;
  lastDigitSum: number | null;
}

const listeners = new Set<(state: GameState) => void>();

export const state: GameState = {
  language: getInitialLanguage(),
  walletBalance: 0,
  selectedTokenValue: 10,
  selectedSide: 'UP',
  tokenPlacements: {},
  betHistory: [],
  betHistoryPage: 0,
  betHistoryPageSize: 10,
  betHistoryPageHasNext: false,
  betHistoryPageItems: [],
  roundHistory: [],
  digitSelections: [],
  lastRoundResult: null,
  lastRoundStake: 0,
  lastRoundPayout: 0,
  lastRoundBets: [],
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
