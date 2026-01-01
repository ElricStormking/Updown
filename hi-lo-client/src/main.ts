import Phaser from 'phaser';
import axios from 'axios';
import './style.css';
import { HiLoScene } from './scenes/HiLoScene';
import { initControls, setStatus } from './ui/domControls';
import type { BetSide, DigitBetType } from './types';
import { api } from './services/api';
import { authenticateGameSocket, createGameSocket } from './services/socket';
import { state, updateState } from './state/gameState';
import { initTradingViewWidget } from './ui/tradingViewWidget';

const scene = new HiLoScene();

initControls({
  onLogin: handleLogin,
  onPlaceHiLoBet: handlePlaceHiLoBet,
  onPlaceDigitBet: handlePlaceDigitBet,
});

void initTradingViewWidget().catch((error: unknown) =>
  console.error('TradingView widget failed to init', error),
);

const getGameSize = () => {
  const fallback = { width: 750, height: 600 };
  if (typeof window === 'undefined') {
    return fallback;
  }
  if (window.innerWidth <= 900) {
    const width = Math.max(320, Math.min(420, window.innerWidth));
    const height = Math.round(width * 0.52);
    return { width, height };
  }
  return fallback;
};

const { width: gameWidth, height: gameHeight } = getGameSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: gameWidth,
  height: gameHeight,
  parent: 'game-container',
  scene: [scene],
  backgroundColor: '#020b16',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

const refreshGameScale = () => {
  game.scale.refresh();
};

if (typeof window !== 'undefined') {
  window.addEventListener('resize', refreshGameScale);
  window.addEventListener('load', refreshGameScale);
  window.addEventListener('app:layout:shown', () => {
    refreshGameScale();
    setTimeout(refreshGameScale, 50);
  });
  if ('ResizeObserver' in window) {
    const container = document.getElementById('game-container');
    if (container) {
      const observer = new ResizeObserver(() => refreshGameScale());
      observer.observe(container);
    }
  }
}

const socket = createGameSocket(
  {
    onPrice: (update) => scene.setPrice(update),
    onRoundStart: (payload) => {
      scene.setRoundState(payload);
      updateState({
        currentRound: payload,
        digitSelections: [],
        tokenPlacements: {},
      });
    },
    onRoundLocked: (payload) => scene.handleRoundLock(payload),
    onRoundResult: async (payload) => {
      scene.handleRoundResult(payload, state.digitSelections);
      updateState({
        lastRoundResult: payload,
        lastDigitResult: payload.digitResult ?? null,
        lastDigitSum: payload.digitSum ?? null,
      });
      await refreshPlayerData();

      const betsForRound = state.betHistory.filter(
        (bet) => bet.roundId === payload.roundId,
      );
      const totalStake = betsForRound.reduce((sum, bet) => sum + bet.amount, 0);
      const totalPayout = betsForRound.reduce(
        (sum, bet) => sum + bet.payout,
        0,
      );
      updateState({
        lastRoundStake: totalStake,
        lastRoundPayout: totalPayout,
      });
      scene.setPlayerPayout(payload.roundId, totalStake, totalPayout);
    },
    onBalance: (balance) => {
      updateState({ walletBalance: balance });
      scene.setBalance(balance);
    },
    onBetPlaced: () => setStatus('Bet accepted via socket!'),
  },
  () => state.token,
);

const buildHiLoBetKey = (side: BetSide) => `HILO|${side}`;
const buildDigitBetKey = (digitType: DigitBetType, selection?: string) =>
  `DIGIT|${digitType}|${selection ?? ''}`;

const addTokenPlacement = (key: string, tokenValue: number) => {
  const nextPlacements = { ...(state.tokenPlacements ?? {}) };
  const existing = nextPlacements[key];
  const nextPlacement =
    existing && existing.value === tokenValue
      ? { value: existing.value, count: existing.count + 1 }
      : { value: tokenValue, count: 1 };
  nextPlacements[key] = nextPlacement;
  updateState({ tokenPlacements: nextPlacements });
  return nextPlacement;
};

const getPlacementTotal = (placement?: { value: number; count: number }) =>
  placement ? placement.value * placement.count : 0;

async function handleLogin(credentials: { account: string; password: string }) {
  const [{ data: auth }, { data: config }] = await Promise.all([
    api.login(credentials.account, credentials.password),
    api.fetchGameConfig(),
  ]);

  updateState({
    token: auth.accessToken,
    user: auth.user,
    config,
    tokenPlacements: {},
  });
  scene.setResultDisplayDuration(
    config.resultDisplayDurationMs ?? 8000,
  );

  await refreshPlayerData();
  authenticateGameSocket(socket, auth.accessToken);
}

async function handlePlaceHiLoBet(side: BetSide) {
  if (!state.token) {
    throw new Error('You must login first.');
  }
  if (!state.currentRound) {
    throw new Error('Waiting for next round to begin.');
  }
  if (state.currentRound.status !== 'BETTING') {
    throw new Error('Not Betting Phase');
  }
  if (new Date(state.currentRound.lockTime).getTime() <= Date.now()) {
    throw new Error('Not Betting Phase');
  }

  const tokenValue = state.selectedTokenValue;
  const amount = clampAmount(tokenValue);
  if (amount !== tokenValue) {
    throw new Error('Token value outside betting limits');
  }
  if (state.walletBalance < amount) {
    throw new Error('Insufficient balance');
  }
  try {
    await api.placeBet(state.token, {
      roundId: state.currentRound.id,
      side,
      amount,
    });
    const nextPlacement = addTokenPlacement(
      buildHiLoBetKey(side),
      tokenValue,
    );
    updateState({ selectedSide: side });
    scene.setPlayerBet(
      side,
      getPlacementTotal(nextPlacement),
    );
  } catch (error) {
    throw new Error(extractBetErrorMessage(error));
  }
  await refreshPlayerData();
}

async function handlePlaceDigitBet(selection: {
  digitType: DigitBetType;
  selection?: string;
}) {
  if (!state.token) {
    throw new Error('You must login first.');
  }
  if (!state.currentRound) {
    throw new Error('Waiting for next round to begin.');
  }
  if (state.currentRound.status !== 'BETTING') {
    throw new Error('Not Betting Phase');
  }
  if (new Date(state.currentRound.lockTime).getTime() <= Date.now()) {
    throw new Error('Not Betting Phase');
  }

  const tokenValue = state.selectedTokenValue;
  const amount = clampAmount(tokenValue);
  if (amount !== tokenValue) {
    throw new Error('Token value outside betting limits');
  }
  if (state.walletBalance < amount) {
    throw new Error('Insufficient balance');
  }

  try {
    const response = await api.placeBet(state.token, {
      roundId: state.currentRound.id,
      amount,
      betType: 'DIGIT',
      digitType: selection.digitType,
      selection: selection.selection,
    });
    const bet = response.data?.bet;
    if (bet?.digitType) {
      const roundId = state.currentRound.id;
      const key = `${bet.digitType}|${bet.selection ?? ''}`;
      const next = state.digitSelections.filter(
        (item) => item.roundId === roundId,
      );
      if (
        !next.some((item) => `${item.digitType}|${item.selection ?? ''}` === key)
      ) {
        next.push({
          roundId,
          digitType: bet.digitType,
          selection: bet.selection ?? null,
        });
        updateState({ digitSelections: next });
      }
    }
    addTokenPlacement(
      buildDigitBetKey(selection.digitType, selection.selection),
      tokenValue,
    );
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

  const latestCompletedRound =
    roundsRes.data.find((round) => Boolean(round.digitResult)) ?? null;
  const latestDigitResult =
    latestCompletedRound?.digitResult ?? state.lastDigitResult;
  const latestDigitSum = latestCompletedRound?.digitSum ?? state.lastDigitSum;

  const inferredLastRoundResult = latestCompletedRound
    ? {
        roundId: latestCompletedRound.id,
        lockedPrice: latestCompletedRound.lockedPrice,
        finalPrice: latestCompletedRound.finalPrice,
        digitResult: latestCompletedRound.digitResult,
        digitSum: latestCompletedRound.digitSum,
        winningSide: latestCompletedRound.winningSide,
        stats: {
          totalBets: 0,
          winners: 0,
          refunded: 0,
          totalVolume: 0,
        },
      }
    : null;
  const lastRoundResult =
    inferredLastRoundResult &&
    (state.lastRoundResult === null ||
      inferredLastRoundResult.roundId >= state.lastRoundResult.roundId)
      ? inferredLastRoundResult
      : state.lastRoundResult;

  const summaryRoundId = lastRoundResult?.roundId;
  const summaryBets = summaryRoundId
    ? betsRes.data.filter((bet) => bet.roundId === summaryRoundId)
    : [];
  const lastRoundStake = summaryBets.reduce((sum, bet) => sum + bet.amount, 0);
  const lastRoundPayout = summaryBets.reduce(
    (sum, bet) => sum + bet.payout,
    0,
  );

  updateState({
    walletBalance: Number(walletRes.data.balance),
    betHistory: betsRes.data,
    roundHistory: roundsRes.data,
    lastRoundResult,
    lastRoundStake,
    lastRoundPayout,
    lastDigitResult: latestDigitResult,
    lastDigitSum: latestDigitSum,
  });
  scene.setBalance(Number(walletRes.data.balance));
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
