import Phaser from 'phaser';
import axios from 'axios';
import './style.css';
import { HiLoScene } from './scenes/HiLoScene';
import { initControls, setStatus } from './ui/domControls';
import { api } from './services/api';
import { createGameSocket } from './services/socket';
import { state, updateState } from './state/gameState';

const scene = new HiLoScene();

initControls({
  onLogin: handleLogin,
  onPlaceBet: handlePlaceBet,
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 600,
  parent: 'game-container',
  scene: [scene],
  backgroundColor: '#020b16',
});

let socket: ReturnType<typeof createGameSocket> | null = null;

async function handleLogin(credentials: { email: string; password: string }) {
  const [{ data: auth }, { data: config }] = await Promise.all([
    api.login(credentials.email, credentials.password),
    api.fetchGameConfig(),
  ]);

  updateState({
    token: auth.accessToken,
    user: auth.user,
    config,
  });

  await refreshPlayerData();
  setupSocket(auth.accessToken);
}

async function handlePlaceBet() {
  if (!state.token) {
    throw new Error('You must login first.');
  }
  if (!state.currentRound) {
    throw new Error('Waiting for next round to begin.');
  }
  if (state.currentRound.status !== 'BETTING') {
    throw new Error('Not Betting Phase');
  }

  const amount = clampAmount(state.betAmount);
  try {
    await api.placeBet(state.token, {
      roundId: state.currentRound.id,
      side: state.selectedSide,
      amount,
    });
    scene.setPlayerBet(state.selectedSide, amount);
  } catch (error) {
    throw new Error(extractBetErrorMessage(error));
  }
  await refreshPlayerData();
}

function clampAmount(amount: number) {
  if (!state.config) {
    return amount;
  }
  return Math.min(
    state.config.maxBetAmount,
    Math.max(state.config.minBetAmount, amount),
  );
}

async function refreshPlayerData() {
  if (!state.token) return;
  const [walletRes, betsRes, roundsRes] = await Promise.all([
    api.fetchWallet(state.token),
    api.fetchPlayerHistory(state.token, 10),
    api.fetchRoundHistory(10),
  ]);

  updateState({
    walletBalance: Number(walletRes.data.balance),
    betHistory: betsRes.data,
    roundHistory: roundsRes.data,
  });
  scene.setBalance(Number(walletRes.data.balance));
}

function setupSocket(token: string) {
  socket?.disconnect();
  socket = createGameSocket(token, {
    onPrice: (update) => scene.setPrice(update),
    onRoundStart: (payload) => {
      scene.setRoundState(payload);
      updateState({ currentRound: payload });
    },
    onRoundLocked: (payload) => scene.handleRoundLock(payload),
    onRoundResult: async (payload) => {
      scene.handleRoundResult(payload);
      await refreshPlayerData();

      const betsForRound = state.betHistory.filter(
        (bet) => bet.roundId === payload.roundId,
      );
      const totalStake = betsForRound.reduce(
        (sum, bet) => sum + bet.amount,
        0,
      );
      const totalPayout = betsForRound.reduce(
        (sum, bet) => sum + bet.payout,
        0,
      );
      scene.setPlayerPayout(payload.roundId, totalStake, totalPayout);
    },
    onBalance: (balance) => {
      updateState({ walletBalance: balance });
      scene.setBalance(balance);
    },
    onBetPlaced: () => setStatus('Bet accepted via socket!'),
  });
}

function extractBetErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as { message?: unknown } | undefined;
    const rawMessage = data?.message;

    let message: string | undefined;
    if (typeof rawMessage === 'string') {
      message = rawMessage;
    } else if (Array.isArray(rawMessage) && typeof rawMessage[0] === 'string') {
      [message] = rawMessage;
    }

    if (status === 400 && message) {
      if (
        message.includes('Betting window is closed') ||
        message.includes('Round already locked')
      ) {
        return 'Not Betting Phase';
      }
      return message;
    }

    return `Request failed with status ${status ?? 'unknown'}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Bet rejected';
}

// Keep the TypeScript compiler happy with the unused variable in some contexts.
void game;

