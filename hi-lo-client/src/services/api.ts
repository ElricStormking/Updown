import axios from 'axios';
import type {
  AuthResponse,
  BetHistoryItem,
  BetHistoryPageResponse,
  ClearRoundBetsResponse,
  GameConfig,
  LaunchSessionStartResponse,
  RoundHistoryItem,
  WalletResponse,
} from '../types';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const hasWindow = typeof window !== 'undefined';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const isLocalBrowserHost = () => {
  if (!hasWindow) return true;
  return LOCAL_HOSTNAMES.has(window.location.hostname);
};

const resolveGatewayOrigin = () => {
  if (!hasWindow) return 'http://localhost:4000';
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4000`;
};

const gatewayOrigin = trimTrailingSlash(
  import.meta.env.VITE_GATEWAY_URL ?? resolveGatewayOrigin(),
);

const GAME_API_URL = trimTrailingSlash(
  import.meta.env.VITE_API_URL ??
    (isLocalBrowserHost() ? 'http://localhost:4001' : gatewayOrigin),
);
const INTEGRATION_API_URL = trimTrailingSlash(
  import.meta.env.VITE_INTEGRATION_API_URL ??
    import.meta.env.VITE_API_URL ??
    (isLocalBrowserHost() ? 'http://localhost:4003' : gatewayOrigin),
);

const gameClient = axios.create({
  baseURL: GAME_API_URL,
  withCredentials: true,
});

const integrationClient = axios.create({
  baseURL: INTEGRATION_API_URL,
  withCredentials: true,
});

const authHeader = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

export const api = {
  login: (account: string, password: string) =>
    gameClient.post<AuthResponse>('/auth/login', { account, password }),

  startLaunchSession: (token: string) =>
    integrationClient.post<LaunchSessionStartResponse>(
      '/integration/launch/session/start',
      {},
      authHeader(token),
    ),

  fetchWallet: (token: string) =>
    gameClient.get<WalletResponse>('/wallet', authHeader(token)),

  fetchGameConfig: (token: string, merchantId?: string) =>
    gameClient.get<GameConfig>('/config/game', {
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
    gameClient.get<BetHistoryItem[]>(
      '/history/bets',
      Object.assign(authHeader(token), {
        params: { limit },
      }),
    ),

  fetchPlayerHistoryPaged: (token: string, page: number, limit?: number) =>
    gameClient.get<BetHistoryPageResponse>(
      '/history/bets/paged',
      Object.assign(authHeader(token), {
        params: { page, limit },
      }),
    ),

  fetchPlayerBetsForRound: (token: string, roundId: number) =>
    gameClient.get<BetHistoryItem[]>(
      `/history/bets/round/${roundId}`,
      authHeader(token),
    ),

  fetchRoundHistory: (limit?: number) =>
    gameClient.get<RoundHistoryItem[]>('/history/rounds', {
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
  ) => gameClient.post('/bets', payload, authHeader(token)),

  clearRoundBets: (token: string, roundId: number) =>
    gameClient.delete<ClearRoundBetsResponse>(
      `/bets/round/${roundId}`,
      authHeader(token),
    ),
};
