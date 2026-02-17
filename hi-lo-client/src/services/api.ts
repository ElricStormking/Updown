import axios from 'axios';
import type {
  AuthResponse,
  BetHistoryItem,
  BetHistoryPageResponse,
  ClearRoundBetsResponse,
  GameConfig,
  RoundHistoryItem,
  WalletResponse,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4001';

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const authHeader = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const api = {
  login: (account: string, password: string) =>
    client.post<AuthResponse>('/auth/login', { account, password }),

  fetchWallet: (token: string) =>
    client.get<WalletResponse>('/wallet', authHeader(token)),

  fetchGameConfig: (token: string, merchantId?: string) =>
    client.get<GameConfig>('/config/game', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      params: {
        _t: Date.now(),
        ...(merchantId ? { merchantId } : {}),
      },
    }),

  fetchPlayerHistory: (token: string, limit?: number) =>
    client.get<BetHistoryItem[]>(
      '/history/bets',
      Object.assign(authHeader(token), {
        params: { limit },
      }),
    ),

  fetchPlayerHistoryPaged: (token: string, page: number, limit?: number) =>
    client.get<BetHistoryPageResponse>(
      '/history/bets/paged',
      Object.assign(authHeader(token), {
        params: { page, limit },
      }),
    ),

  fetchPlayerBetsForRound: (token: string, roundId: number) =>
    client.get<BetHistoryItem[]>(
      `/history/bets/round/${roundId}`,
      authHeader(token),
    ),

  fetchRoundHistory: (limit?: number) =>
    client.get<RoundHistoryItem[]>('/history/rounds', {
      params: { limit },
    }),

  placeBet: (
    token: string,
    payload: {
      roundId: number;
      amount: number;
      side?: 'UP' | 'DOWN';
      betType?: 'HILO' | 'DIGIT';
      digitType?: string;
      selection?: string;
    },
  ) => client.post('/bets', payload, authHeader(token)),

  clearRoundBets: (token: string, roundId: number) =>
    client.delete<ClearRoundBetsResponse>(`/bets/round/${roundId}`, authHeader(token)),
};
