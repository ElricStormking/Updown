import Phaser from 'phaser';
import axios from 'axios';
import './style.css';
import { HiLoScene } from './scenes/HiLoScene';
import { initControls, setStatus } from './ui/domControls';
import type { BetSide, DigitBetType } from './types';
import { api } from './services/api';
import { authenticateGameSocket, createGameSocket } from './services/socket';
import { state, updateState } from './state/gameState';
import {
  initTradingViewWidget,
  pushPriceUpdate,
  setLockedPrice,
  setRoundTiming,
} from './ui/tradingViewWidget';
import type { LanguageCode } from './i18n';

const scene = new HiLoScene();

initControls({
  onLogin: handleLogin,
  onPlaceHiLoBet: handlePlaceHiLoBet,
  onPlaceDigitBet: handlePlaceDigitBet,
  onClearTokens: handleClearTokens,
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
  banner: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

type AudioSettings = { musicEnabled: boolean; sfxEnabled: boolean };
const AUDIO_SETTINGS_KEY = 'audioSettings';

const loadAudioSettings = (): AudioSettings => {
  if (typeof window === 'undefined') return { musicEnabled: true, sfxEnabled: true };
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return { musicEnabled: true, sfxEnabled: true };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      musicEnabled: parsed.musicEnabled !== false,
      sfxEnabled: parsed.sfxEnabled !== false,
    };
  } catch {
    return { musicEnabled: true, sfxEnabled: true };
  }
};

const applyAudioSettings = (settings: AudioSettings) => {
  // We don't have separate channels yet; treat "both off" as global mute.
  const enabled = settings.musicEnabled || settings.sfxEnabled;
  game.sound.mute = !enabled;
};

applyAudioSettings(loadAudioSettings());

const refreshGameScale = () => {
  game.scale.refresh();
};

if (typeof window !== 'undefined') {
  // Apply initial language to Phaser scene
  scene.setLanguage(state.language as LanguageCode);
  window.addEventListener('app:language', (event) => {
    const lang = (event as CustomEvent<LanguageCode>).detail;
    if (!lang) return;
    updateState({ language: lang });
    scene.setLanguage(lang);
  });

  window.addEventListener('app:audio-settings', (event) => {
    const detail = (event as CustomEvent<AudioSettings>).detail;
    if (!detail) return;
    applyAudioSettings(detail);
  });

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
    onPrice: (update) => {
      scene.setPrice(update);
      pushPriceUpdate(update);
    },
    onRoundStart: (payload) => {
      scene.setRoundState(payload);
      setRoundTiming(payload.lockTime, payload.endTime);
      setLockedPrice(null);
      updateState({
        currentRound: payload,
        digitSelections: [],
        tokenPlacements: {},
      });
      const currentVersion = state.config?.configVersion ?? null;
      const nextVersion = payload.configVersion ?? null;
      if (!currentVersion || !nextVersion || currentVersion !== nextVersion) {
        void refreshConfig();
      }
    },
    onRoundLocked: async (payload) => {
      scene.handleRoundLock(payload);
      setLockedPrice(payload.lockedPrice ?? null);
      // Batch-write mode: wallet is debited at lock (when slips are committed on server).
      await refreshPlayerData();
    },
    onRoundResult: async (payload) => {
      scene.handleRoundResult(payload);
      setLockedPrice(null);
      updateState({
        lastRoundResult: payload,
        lastDigitResult: payload.digitResult ?? null,
        lastDigitSum: payload.digitSum ?? null,
      });
      await refreshPlayerData();

      // Fallback: if the per-user settlement socket event is missed, pull the round bets from server.
      if (
        state.token &&
        (!state.lastRoundBets.length ||
          state.lastRoundBets[0]?.roundId !== payload.roundId)
      ) {
        try {
          const res = await api.fetchPlayerBetsForRound(
            state.token,
            payload.roundId,
          );
          const bets = res.data;
          const stake = bets.reduce((sum, b) => sum + b.amount, 0);
          const payout = bets.reduce((sum, b) => sum + b.payout, 0);
          const winningPayout = bets
            .filter((b) => b.result === 'WIN')
            .reduce((sum, b) => sum + b.payout, 0);
          const losingStake = bets
            .filter((b) => b.result === 'LOSE')
            .reduce((sum, b) => sum + b.amount, 0);

          updateState({
            lastRoundBets: bets,
            lastRoundStake: stake,
            lastRoundPayout: payout,
          });

          scene.setPlayerPayout(payload.roundId, stake, payout);
          if (stake <= 0) scene.setRoundOutcome(payload.roundId, 'SKIPPED');
          else if (winningPayout > losingStake) scene.setRoundOutcome(payload.roundId, 'WIN');
          else scene.setRoundOutcome(payload.roundId, 'LOSE');
          scene.setWinningBets(payload.roundId, bets);
        } catch {
          // ignore: socket settlement event should normally cover this
        }
      }
    },
    onRoundUserSettlement: (payload) => {
      updateState({
        lastRoundBets: payload.bets,
        lastRoundStake: payload.totals.stake,
        lastRoundPayout: payload.totals.payout,
      });

      scene.setPlayerPayout(
        payload.roundId,
        payload.totals.stake,
        payload.totals.payout,
      );

      // Outcome is derived from server-settled bets (payout vs losing stake)
      const { stake } = payload.totals;
      const winningPayout = payload.bets
        .filter((b) => b.result === 'WIN')
        .reduce((sum, b) => sum + b.payout, 0);
      const losingStake = payload.bets
        .filter((b) => b.result === 'LOSE')
        .reduce((sum, b) => sum + b.amount, 0);
      if (stake <= 0) {
        scene.setRoundOutcome(payload.roundId, 'SKIPPED');
      } else if (winningPayout > losingStake) {
        scene.setRoundOutcome(payload.roundId, 'WIN');
      } else {
        scene.setRoundOutcome(payload.roundId, 'LOSE');
      }

      scene.setWinningBets(payload.roundId, payload.bets);
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

const getTotalPlacedStake = () =>
  Object.values(state.tokenPlacements ?? {}).reduce(
    (sum, placement) => sum + getPlacementTotal(placement),
    0,
  );

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

async function refreshConfig() {
  try {
    const { data: config } = await api.fetchGameConfig();
    updateState({ config });
    scene.setResultDisplayDuration(
      config.resultDisplayDurationMs ?? 8000,
    );
  } catch {
    // Ignore config refresh failures; we keep the last known config.
  }
}

async function handlePlaceHiLoBet(_side: BetSide) {
  throw new Error('Hi-Lo betting is disabled.');
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
  if (state.walletBalance < getTotalPlacedStake() + amount) {
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

async function handleClearTokens() {
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
    throw new Error('Round already locked');
  }

  const roundId = state.currentRound.id;
  const res = await api.clearRoundBets(state.token, roundId);

  updateState({
    walletBalance: res.data.walletBalance,
    tokenPlacements: {},
    digitSelections: [],
  });
  scene.clearPlayerBets();

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
    api.fetchRoundHistory(20),
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
  const summaryBets =
    summaryRoundId && state.lastRoundBets.length && state.lastRoundBets[0]?.roundId === summaryRoundId
      ? state.lastRoundBets
      : summaryRoundId
        ? betsRes.data.filter((bet) => bet.roundId === summaryRoundId)
        : [];
  const lastRoundStake = summaryBets.reduce((sum, bet) => sum + bet.amount, 0);
  const lastRoundPayout = summaryBets.reduce((sum, bet) => sum + bet.payout, 0);

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
