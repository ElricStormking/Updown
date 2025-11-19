import axios from 'axios';
import type {
  AuthResponse,
  BetHistoryItem,
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
  login: (email: string, password: string) =>
    client.post<AuthResponse>('/auth/login', { email, password }),

  fetchWallet: (token: string) =>
    client.get<WalletResponse>('/wallet', authHeader(token)),

  fetchGameConfig: () => client.get<GameConfig>('/config/game'),

  fetchPlayerHistory: (token: string, limit?: number) =>
    client.get<BetHistoryItem[]>(
      '/history/bets',
      Object.assign(authHeader(token), {
        params: { limit },
      }),
    ),

  fetchRoundHistory: (limit?: number) =>
    client.get<RoundHistoryItem[]>('/history/rounds', {
      params: { limit },
    }),

  placeBet: (
    token: string,
    payload: { roundId: number; side: 'UP' | 'DOWN'; amount: number },
  ) => client.post('/bets', payload, authHeader(token)),
};

