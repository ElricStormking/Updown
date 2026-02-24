import { io, Socket } from 'socket.io-client';
import type {
  RoundUserSettlementPayload,
  PriceUpdate,
  RoundLockPayload,
  RoundResultPayload,
  RoundStatePayload,
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

const WS_URL = trimTrailingSlash(
  import.meta.env.VITE_WS_URL ??
    import.meta.env.VITE_API_URL ??
    import.meta.env.VITE_GATEWAY_URL ??
    (isLocalBrowserHost() ? 'http://localhost:4001' : resolveGatewayOrigin()),
);

export interface GameSocketCallbacks {
  onPrice(update: PriceUpdate): void;
  onRoundStart(payload: RoundStatePayload): void;
  onRoundLocked(payload: RoundLockPayload): void;
  onRoundResult(payload: RoundResultPayload): void;
  onRoundUserSettlement(payload: RoundUserSettlementPayload): void;
  onBalance(balance: number): void;
  onBetPlaced(): void;
}

export const createGameSocket = (
  callbacks: GameSocketCallbacks,
  getToken?: () => string | undefined,
) => {
  const socket: Socket = io(`${WS_URL}/game`, {
    withCredentials: true,
    autoConnect: false,
  });

  socket.on('connect', () => {
    const token = getToken?.();
    if (token) {
      socket.emit('client:ready', { token });
    }
  });

  socket.on('price:update', callbacks.onPrice);
  socket.on('round:start', callbacks.onRoundStart);
  socket.on('round:locked', callbacks.onRoundLocked);
  socket.on('round:result', callbacks.onRoundResult);
  socket.on('round:user-settlement', callbacks.onRoundUserSettlement);
  socket.on('balance:update', (payload: { balance: number }) =>
    callbacks.onBalance(payload.balance),
  );
  socket.on('bet:placed', callbacks.onBetPlaced);

  return socket;
};

export const authenticateGameSocket = (socket: Socket, token: string) => {
  if (socket.connected) {
    socket.emit('client:ready', { token });
    return;
  }
  socket.connect();
};

