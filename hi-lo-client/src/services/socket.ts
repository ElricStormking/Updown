import { io, Socket } from 'socket.io-client';
import type {
  PriceUpdate,
  RoundLockPayload,
  RoundResultPayload,
  RoundStatePayload,
} from '../types';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:4001';

export interface GameSocketCallbacks {
  onPrice(update: PriceUpdate): void;
  onRoundStart(payload: RoundStatePayload): void;
  onRoundLocked(payload: RoundLockPayload): void;
  onRoundResult(payload: RoundResultPayload): void;
  onBalance(balance: number): void;
  onBetPlaced(): void;
}

export const createGameSocket = (
  token: string,
  callbacks: GameSocketCallbacks,
) => {
  const socket: Socket = io(`${WS_URL}/game`, {
    withCredentials: true,
  });

  socket.on('connect', () => {
    socket.emit('client:ready', { token });
  });

  socket.on('price:update', callbacks.onPrice);
  socket.on('round:start', callbacks.onRoundStart);
  socket.on('round:locked', callbacks.onRoundLocked);
  socket.on('round:result', callbacks.onRoundResult);
  socket.on('balance:update', (payload: { balance: number }) =>
    callbacks.onBalance(payload.balance),
  );
  socket.on('bet:placed', callbacks.onBetPlaced);

  return socket;
};

