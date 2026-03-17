import Phaser from 'phaser';
import axios from 'axios';
import './style.css';
import { HiLoScene } from './scenes/HiLoScene';
import {
  initControls,
  setAuthFormLocked,
  setStatus,
  showSessionExpiredAlert,
} from './ui/domControls';
import type { BetSide, DigitBetType } from './types';
import {
  api,
  setAccessTokenRefreshListener,
  setAuthFailureListener,
} from './services/api';
import { authenticateGameSocket, createGameSocket } from './services/socket';
import {
  state,
  subscribe,
  updateState,
  type TokenPlacement,
} from './state/gameState';
import {
  initTradingViewWidget,
  pushPriceUpdate,
  setPriceFreeze,
  setLockedPrice,
  setRoundTiming,
} from './ui/tradingViewWidget';
import type { LanguageCode } from './i18n';

type LaunchTokenPayload = {
  sub?: string;
  account?: string;
  merchantId?: string;
  exp?: number;
  type?: 'user' | 'admin' | string;
};

const MERCHANT_ID_STORAGE_KEY = 'merchantId';

const readMerchantIdFromUrl = () => {
  if (typeof window === 'undefined') return '';
  return (new URLSearchParams(window.location.search).get('merchantId') ?? '').trim();
};

const readMerchantIdFromStorage = () => {
  if (typeof window === 'undefined') return '';
  return (window.localStorage.getItem(MERCHANT_ID_STORAGE_KEY) ?? '').trim();
};

const persistMerchantId = (merchantId: string) => {
  if (typeof window === 'undefined') return;
  const next = merchantId.trim();
  if (!next) return;
  window.localStorage.setItem(MERCHANT_ID_STORAGE_KEY, next);
};

const getMerchantId = () =>
  state.merchantId?.trim() ||
  readMerchantIdFromUrl() ||
  readMerchantIdFromStorage() ||
  '';

const decodeJwtPayload = (token: string): LaunchTokenPayload | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded)) as LaunchTokenPayload;
  } catch {
    return null;
  }
};

const getTokenSubject = (token: string) => {
  const subject = decodeJwtPayload(token)?.sub;
  return typeof subject === 'string' ? subject.trim() : '';
};

const getTokenExpiryTimeMs = (token: string) => {
  const exp = decodeJwtPayload(token)?.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0) {
    return null;
  }
  return exp * 1000;
};

let latestAccessToken = '';
let pendingPlayerTokenSubject = '';
let lastPlayerSessionExpiryMessage = '';

const rememberAccessToken = (accessToken: string) => {
  const nextToken = accessToken.trim();
  if (!nextToken) {
    return;
  }

  const tokenSubject = getTokenSubject(nextToken);
  const currentUserId = state.user?.id?.trim() ?? '';
  const expectedSubject = currentUserId || pendingPlayerTokenSubject;
  if (expectedSubject && tokenSubject && tokenSubject !== expectedSubject) {
    return;
  }
  if (!currentUserId && !pendingPlayerTokenSubject && !state.token) {
    return;
  }

  latestAccessToken = nextToken;
  if (state.token !== nextToken) {
    updateState({ token: nextToken });
  }
};

const resolveAccessToken = (fallbackToken: string) =>
  latestAccessToken.trim() || fallbackToken;

const clearLaunchTokenFromUrl = () => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('accessToken')) return;
  url.searchParams.delete('accessToken');
  window.history.replaceState({}, document.title, url.toString());
};

const scene = new HiLoScene();

initControls({
  onLogin: handleLogin,
  onPlaceHiLoBet: handlePlaceHiLoBet,
  onPlaceDigitBet: handlePlaceDigitBet,
  onClearTokens: handleClearTokens,
});

scene.setBetHandlers({
  onSelectToken: (value) => {
    updateState({ selectedTokenValue: value });
  },
  onClearTokens: () => handleClearTokens(),
  onPlaceDigitBet: (selection) => handlePlaceDigitBet(selection),
  onOpenSettings: () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:open-settings'));
    }
  },
});

void initTradingViewWidget().catch((error: unknown) =>
  console.error('TradingView widget failed to init', error),
);

const getGameSize = () => ({ width: 1080, height: 1920 });

const { width: gameWidth, height: gameHeight } = getGameSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: gameWidth,
  height: gameHeight,
  parent: 'game-container',
  scene: [scene],
  backgroundColor: '#020b16',
  banner: false,
  input: {
    mouse: { preventDefault: true },
    touch: { capture: true },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
});

const DEFAULT_TOKEN_VALUES = [10, 50, 100, 150, 200, 300, 500];
const COMPLETE_PHASE_DURATION_MS = 10000;
const CONFIG_REFRESH_RETRY_DELAYS_MS = [0, 900, 2200];
const PLAYER_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const PLAYER_IDLE_LOGOUT_MESSAGE =
  'Your session expired after 15 minutes of inactivity. This window will close shortly. Tap Confirm to continue.';
const PLAYER_TOKEN_EXPIRED_MESSAGE =
  'Your session has expired. This window will close shortly. Tap Confirm to continue.';
const INVALID_LAUNCH_LINK_MESSAGE =
  'This launch link is invalid or no longer available. This window will close shortly. Tap Confirm to continue.';
const PLAYER_ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'input',
  'change',
  'focusin',
  'touchstart',
  'wheel',
] as const;
let lastConfigRefreshRoundId: number | null = null;
let playerDataRefreshRequestId = 0;
const delay = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));
const normalizeTokenValues = (values?: number[]) => {
  if (!Array.isArray(values) || values.length !== DEFAULT_TOKEN_VALUES.length) {
    return DEFAULT_TOKEN_VALUES.slice();
  }
  const normalized = values.map((value) => Number(value));
  if (normalized.some((value) => !Number.isFinite(value) || value <= 0)) {
    return DEFAULT_TOKEN_VALUES.slice();
  }
  return normalized;
};
const resolveSelectedTokenValue = (current: number, values: number[]) =>
  values.includes(current) ? current : values[0];

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
  document.addEventListener('fullscreenchange', refreshGameScale);
  document.addEventListener('webkitfullscreenchange', refreshGameScale);
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
      setPriceFreeze(false);
      setLockedPrice(null);
      const nextPlacements: Record<string, TokenPlacement> = {};
      updateState({
        currentRound: payload,
        digitSelections: [],
        tokenPlacements: nextPlacements,
        walletBalance: deriveDisplayedWalletBalance(
          state.serverWalletBalance,
          nextPlacements,
          payload,
        ),
      });
      // Merchant-tuned odds must be reflected every new round start.
      if (lastConfigRefreshRoundId !== payload.id) {
        lastConfigRefreshRoundId = payload.id;
        void refreshConfigForRoundStart(payload.id);
      }
    },
    onRoundLocked: async (payload) => {
      scene.handleRoundLock(payload);
      setLockedPrice(payload.lockedPrice ?? null);
      const current = state.currentRound;
      if (current && current.id === payload.roundId) {
        updateState({
          currentRound: {
            ...current,
            status: 'RESULT_PENDING',
            lockedPrice: payload.lockedPrice ?? current.lockedPrice ?? null,
            digitBonus: payload.digitBonus ?? current.digitBonus,
          },
        });
      }
      // Batch-write mode: wallet is debited at lock (when slips are committed on server).
      await refreshPlayerData();
    },
    onRoundResult: async (payload) => {
      scene.handleRoundResult(payload);
      setPriceFreeze(true, payload.finalPrice ?? payload.lockedPrice ?? null);
      setLockedPrice(null);
      const current = state.currentRound;
      const nextRound =
        current && current.id === payload.roundId
          ? {
              ...current,
              status: 'COMPLETED',
              lockedPrice: payload.lockedPrice ?? current.lockedPrice ?? null,
              finalPrice: payload.finalPrice ?? current.finalPrice ?? null,
              winningSide: payload.winningSide ?? current.winningSide ?? null,
            }
          : current;
      updateState({
        lastRoundResult: payload,
        lastDigitResult: payload.digitResult ?? null,
        lastDigitSum: payload.digitSum ?? null,
        currentRound: nextRound,
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
      const serverWalletBalance = Number(balance);
      const walletBalance = deriveDisplayedWalletBalance(serverWalletBalance);
      updateState({ serverWalletBalance, walletBalance });
      scene.setBalance(walletBalance);
    },
    onBetPlaced: () => setStatus('Bet accepted via socket!'),
    onToken: rememberAccessToken,
    onConnectionStatus: (status) => {
      if (status === 'reconnecting') {
        setStatus('Connection lost. Reconnecting...', true);
      } else if (status === 'connected') {
        setStatus('Connected.');
      }
    },
  },
  () => state.token,
);
setAccessTokenRefreshListener(rememberAccessToken);

let lastPlayerActivityAt = 0;
let playerIdleTimer: ReturnType<typeof setTimeout> | null = null;
let playerJwtExpiryTimer: ReturnType<typeof setTimeout> | null = null;
let playerIdleTrackingBound = false;
let previousPlayerToken = state.token;
let playerSessionClosePending = false;

const clearPlayerIdleTimer = () => {
  if (playerIdleTimer) {
    clearTimeout(playerIdleTimer);
    playerIdleTimer = null;
  }
};

const clearPlayerJwtExpiryTimer = () => {
  if (playerJwtExpiryTimer) {
    clearTimeout(playerJwtExpiryTimer);
    playerJwtExpiryTimer = null;
  }
};

const hasPlayerSessionTimedOut = () =>
  Boolean(state.token) &&
  lastPlayerActivityAt > 0 &&
  Date.now() - lastPlayerActivityAt >= PLAYER_IDLE_TIMEOUT_MS;

const clearPlayerSession = (statusMessage?: string) => {
  lastConfigRefreshRoundId = null;
  playerDataRefreshRequestId += 1;
  latestAccessToken = '';
  pendingPlayerTokenSubject = '';
  clearPlayerIdleTimer();
  clearPlayerJwtExpiryTimer();
  socket.disconnect();
  scene.clearPlayerBets();
  scene.setBalance(0);
  setPriceFreeze(false);
  setLockedPrice(null);
  updateState({
    token: undefined,
    user: undefined,
    config: undefined,
    serverWalletBalance: 0,
    walletBalance: 0,
    tokenPlacements: {},
    betHistory: [],
    betHistoryPage: 0,
    betHistoryPageHasNext: false,
    betHistoryPageItems: [],
    roundHistory: [],
    currentRound: undefined,
    digitSelections: [],
    lastRoundResult: null,
    lastRoundStake: 0,
    lastRoundPayout: 0,
    lastRoundBets: [],
    lastDigitResult: null,
    lastDigitSum: null,
  });
  setAuthFormLocked(false);
  if (statusMessage) {
    setStatus(statusMessage, true);
  }
};

const closePlayerLaunchWindow = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.close();
  } catch {
    // Ignore close failures and continue with fallbacks.
  }
  if (window.closed) {
    return;
  }
  try {
    window.open('', '_self');
    window.close();
  } catch {
    // Ignore close failures and continue with fallbacks.
  }
  if (!window.closed) {
    window.location.replace('about:blank');
  }
};

const beginForcedWindowCloseFlow = (
  message: string,
  options?: {
    title?: string;
    sceneLabel?: string;
    lockAuthForm?: boolean;
    clearLaunchTokenFromAddress?: boolean;
  },
) => {
  if (playerSessionClosePending) {
    return false;
  }
  playerSessionClosePending = true;
  lastPlayerSessionExpiryMessage = message;
  clearPlayerSession();
  if (options?.clearLaunchTokenFromAddress) {
    clearLaunchTokenFromUrl();
  }
  setAuthFormLocked(Boolean(options?.lockAuthForm));
  showSessionExpiredAlert(message, closePlayerLaunchWindow, {
    title: options?.title,
    sceneLabel: options?.sceneLabel,
    actionLabel: 'Confirm',
  });
  return true;
};

const beginPlayerSessionExpiryFlow = (message: string) => {
  return beginForcedWindowCloseFlow(message, {
    title: 'Session Expired',
    sceneLabel: 'SESSION EXPIRED',
  });
};

const closeWindowForInvalidLaunch = (message = INVALID_LAUNCH_LINK_MESSAGE) => {
  return beginForcedWindowCloseFlow(message, {
    title: 'Invalid Launch Link',
    sceneLabel: 'INVALID LINK',
    lockAuthForm: true,
    clearLaunchTokenFromAddress: true,
  });
};

const formatInvalidLaunchMessage = (message?: string) => {
  const normalized = message?.trim();
  if (!normalized) {
    return INVALID_LAUNCH_LINK_MESSAGE;
  }
  return `${normalized} This window will close shortly. Tap Confirm to continue.`;
};

const expirePlayerSessionForInactivity = () => {
  if (!state.token) {
    return false;
  }
  return beginPlayerSessionExpiryFlow(PLAYER_IDLE_LOGOUT_MESSAGE);
};

const expirePlayerSessionForJwtExpiry = (message = PLAYER_TOKEN_EXPIRED_MESSAGE) => {
  if (!state.token) {
    return false;
  }
  return beginPlayerSessionExpiryFlow(message);
};

const schedulePlayerIdleTimeout = () => {
  clearPlayerIdleTimer();
  if (typeof window === 'undefined' || !state.token || lastPlayerActivityAt <= 0) {
    return;
  }
  const remainingMs = Math.max(
    0,
    PLAYER_IDLE_TIMEOUT_MS - (Date.now() - lastPlayerActivityAt),
  );
  playerIdleTimer = window.setTimeout(() => {
    playerIdleTimer = null;
    if (hasPlayerSessionTimedOut()) {
      expirePlayerSessionForInactivity();
      return;
    }
    schedulePlayerIdleTimeout();
  }, remainingMs);
};

const schedulePlayerJwtExpiryTimeout = (token?: string) => {
  clearPlayerJwtExpiryTimer();
  if (
    typeof window === 'undefined' ||
    !token ||
    playerSessionClosePending
  ) {
    return;
  }
  const expiresAtMs = getTokenExpiryTimeMs(token);
  if (!expiresAtMs) {
    return;
  }
  const remainingMs = expiresAtMs - Date.now();
  if (remainingMs <= 0) {
    expirePlayerSessionForJwtExpiry();
    return;
  }
  playerJwtExpiryTimer = window.setTimeout(() => {
    playerJwtExpiryTimer = null;
    expirePlayerSessionForJwtExpiry();
  }, remainingMs);
};

const notePlayerActivity = () => {
  if (!state.token) {
    return;
  }
  lastPlayerActivityAt = Date.now();
  schedulePlayerIdleTimeout();
};

const handlePlayerActivity = () => {
  notePlayerActivity();
};

const handlePlayerVisibilityResume = () => {
  if (!state.token) {
    return;
  }
  if (
    typeof document !== 'undefined' &&
    document.visibilityState === 'hidden'
  ) {
    return;
  }
  if (hasPlayerSessionTimedOut()) {
    expirePlayerSessionForInactivity();
    return;
  }
  schedulePlayerIdleTimeout();
};

const bindPlayerIdleTracking = () => {
  if (
    playerIdleTrackingBound ||
    typeof document === 'undefined' ||
    typeof window === 'undefined'
  ) {
    return;
  }
  playerIdleTrackingBound = true;
  PLAYER_ACTIVITY_EVENTS.forEach((eventName) => {
    document.addEventListener(eventName, handlePlayerActivity, true);
  });
  document.addEventListener('visibilitychange', handlePlayerVisibilityResume);
  window.addEventListener('focus', handlePlayerVisibilityResume);
};

const unbindPlayerIdleTracking = () => {
  if (
    !playerIdleTrackingBound ||
    typeof document === 'undefined' ||
    typeof window === 'undefined'
  ) {
    return;
  }
  playerIdleTrackingBound = false;
  PLAYER_ACTIVITY_EVENTS.forEach((eventName) => {
    document.removeEventListener(eventName, handlePlayerActivity, true);
  });
  document.removeEventListener(
    'visibilitychange',
    handlePlayerVisibilityResume,
  );
  window.removeEventListener('focus', handlePlayerVisibilityResume);
};

const syncPlayerSessionTracking = () => {
  const hasToken = Boolean(state.token);
  const hadToken = Boolean(previousPlayerToken);
  const tokenChanged = state.token !== previousPlayerToken;
  if (hasToken) {
    pendingPlayerTokenSubject = state.user?.id?.trim() || pendingPlayerTokenSubject;
    if (!hadToken) {
      lastPlayerSessionExpiryMessage = '';
      playerSessionClosePending = false;
      bindPlayerIdleTracking();
      notePlayerActivity();
    }
    if (tokenChanged) {
      schedulePlayerJwtExpiryTimeout(state.token);
    }
  } else if (hadToken) {
    lastPlayerActivityAt = 0;
    clearPlayerIdleTimer();
    clearPlayerJwtExpiryTimer();
    unbindPlayerIdleTracking();
  }
  previousPlayerToken = state.token;
};

const requireActivePlayerSession = () => {
  if (playerSessionClosePending) {
    throw new Error(
      lastPlayerSessionExpiryMessage || PLAYER_TOKEN_EXPIRED_MESSAGE,
    );
  }
  if (!state.token) {
    throw new Error(
      lastPlayerSessionExpiryMessage || 'You must login first.',
    );
  }
  if (!hasPlayerSessionTimedOut()) {
    return;
  }
  expirePlayerSessionForInactivity();
  throw new Error(PLAYER_IDLE_LOGOUT_MESSAGE);
};

subscribe(() => {
  syncPlayerSessionTracking();
});

const extractAuthErrorMessages = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return [] as string[];
  }
  const data = error.response?.data as
    | { message?: unknown; errorMessage?: unknown }
    | undefined;
  const values = [data?.message, data?.errorMessage];
  return values.flatMap((value) => {
    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
    }
    return [];
  });
};

const isPlayerSessionExpiryError = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  if (status !== 401 && status !== 403) {
    return false;
  }
  const normalized = extractAuthErrorMessages(error)
    .join(' ')
    .toLowerCase();
  if (
    normalized.includes('disabled') ||
    normalized.includes('blacklist') ||
    normalized.includes('launch session')
  ) {
    return false;
  }
  return true;
};

setAuthFailureListener((error) => {
  if (!state.token || playerSessionClosePending) {
    return;
  }
  if (!isPlayerSessionExpiryError(error)) {
    return;
  }
  expirePlayerSessionForJwtExpiry();
});

void bootstrapLaunchAuthFromUrl();

const buildHiLoBetKey = (side: BetSide) => `HILO|${side}`;
const buildDigitBetKey = (digitType: DigitBetType, selection?: string) =>
  `DIGIT|${digitType}|${selection ?? ''}`;

const getPlacementTotal = (placement?: TokenPlacement) => placement?.total ?? 0;

const getTotalPlacedStake = (
  placements: Record<string, TokenPlacement> = state.tokenPlacements ?? {},
) =>
  Object.values(placements).reduce(
    (sum, placement) => sum + getPlacementTotal(placement),
    0,
  );

const isBettingWindowOpenForTokenSpend = (
  round = state.currentRound,
) =>
  Boolean(
    round &&
      round.status === 'BETTING' &&
      new Date(round.lockTime).getTime() > Date.now(),
  );

const deriveDisplayedWalletBalance = (
  serverWalletBalance: number,
  placements: Record<string, TokenPlacement> = state.tokenPlacements ?? {},
  round = state.currentRound,
) => {
  const pendingStake = isBettingWindowOpenForTokenSpend(round)
    ? getTotalPlacedStake(placements)
    : 0;
  return Math.max(0, serverWalletBalance - pendingStake);
};

const addTokenPlacement = (key: string, tokenValue: number) => {
  const nextPlacements = { ...(state.tokenPlacements ?? {}) };
  const existing = nextPlacements[key];
  const nextPlacement: TokenPlacement = {
    total: (existing?.total ?? 0) + tokenValue,
    chipValue: tokenValue,
  };
  nextPlacements[key] = nextPlacement;
  updateState({
    tokenPlacements: nextPlacements,
    walletBalance: deriveDisplayedWalletBalance(
      state.serverWalletBalance,
      nextPlacements,
    ),
  });
  return nextPlacement;
};

async function bootstrapLaunchAuthFromUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  let launchToken = (new URLSearchParams(window.location.search).get('accessToken') ?? '').trim();
  if (!launchToken) {
    latestAccessToken = '';
    pendingPlayerTokenSubject = '';
    setAuthFormLocked(false);
    return;
  }
  latestAccessToken = launchToken;

  const decoded = decodeJwtPayload(launchToken);
  pendingPlayerTokenSubject =
    typeof decoded?.sub === 'string' ? decoded.sub.trim() : '';
  const merchantId =
    (new URLSearchParams(window.location.search).get('merchantId') ?? '').trim() ||
    (decoded?.merchantId ?? '').trim() ||
    getMerchantId();

  if (!merchantId) {
    socket.disconnect();
    closeWindowForInvalidLaunch(
      formatInvalidLaunchMessage(
        'Launch token missing merchant ID. Please request a new launch URL.',
      ),
    );
    return;
  }

  try {
    setAuthFormLocked(true);
    setStatus('Verifying launch with merchant...');
    const { data: launchSession } = await api.startLaunchSession(launchToken);
    if (!launchSession.ready) {
      const lockLaunchUrl = shouldLockAuthForBlockedLaunch(
        launchSession.code,
        launchSession.message,
      );
      const blockedReason = launchSession.message?.trim();
      closeWindowForInvalidLaunch(
        formatInvalidLaunchMessage(
          lockLaunchUrl
            ? 'Launch URL disabled because this player account is blacklisted.'
            : blockedReason
              ? `Launch blocked: ${blockedReason}`
              : `Launch blocked (code ${launchSession.code}).`,
        ),
      );
      return;
    }

    setStatus('Launch verified. Loading game...');
    const [{ data: config }, { data: wallet }] = await Promise.all([
      api.fetchGameConfig(launchToken, merchantId),
      api.fetchWallet(launchToken),
    ]);
    launchToken = resolveAccessToken(launchToken);
    const launchUserId = getTokenSubject(launchToken);
    const serverWalletBalance = Number(wallet.balance);
    const nextPlacements: Record<string, TokenPlacement> = {};
    const tokenValues = normalizeTokenValues(config?.tokenValues);
    const selectedTokenValue = resolveSelectedTokenValue(
      state.selectedTokenValue,
      tokenValues,
    );

    updateState({
      token: launchToken,
      user: {
        id: launchUserId || (typeof decoded?.sub === 'string' ? decoded.sub : ''),
        account:
          typeof decoded?.account === 'string' && decoded.account.trim()
            ? decoded.account
            : 'player',
      },
      merchantId,
      config,
      serverWalletBalance,
      walletBalance: deriveDisplayedWalletBalance(
        serverWalletBalance,
        nextPlacements,
      ),
      selectedTokenValue,
      tokenPlacements: nextPlacements,
    });
    pendingPlayerTokenSubject = launchUserId || pendingPlayerTokenSubject;
    persistMerchantId(merchantId);
    scene.setResultDisplayDuration(COMPLETE_PHASE_DURATION_MS);

    authenticateGameSocket(socket, launchToken);
    void refreshPlayerData();
    clearLaunchTokenFromUrl();
    setAuthFormLocked(false);
    setStatus('Authenticated. Waiting for round updates.');
  } catch (error) {
    const lockLaunchUrl = shouldLockAuthForLaunchError(error);
    socket.disconnect();
    closeWindowForInvalidLaunch(
      formatInvalidLaunchMessage(
        lockLaunchUrl
          ? 'Launch URL disabled because this player account is blacklisted.'
          : extractLaunchErrorMessage(error),
      ),
    );
  }
}

async function handleLogin(credentials: { account: string; password: string; merchantId: string }) {
  lastConfigRefreshRoundId = null;
  const { data: auth } = await api.login(credentials.account, credentials.password);
  let accessToken = auth.accessToken;
  latestAccessToken = accessToken;
  pendingPlayerTokenSubject = auth.user.id.trim();
  const { data: config } = await api.fetchGameConfig(
    accessToken,
    credentials.merchantId.trim(),
  );
  accessToken = resolveAccessToken(accessToken);
  pendingPlayerTokenSubject =
    getTokenSubject(accessToken) || auth.user.id.trim();
  const merchantId =
    auth.user?.merchantId?.trim() ||
    credentials.merchantId.trim() ||
    getMerchantId() ||
    '';
  if (!merchantId) {
    throw new Error('Merchant ID is required.');
  }

  const tokenValues = normalizeTokenValues(config?.tokenValues);
  const selectedTokenValue = resolveSelectedTokenValue(
    state.selectedTokenValue,
    tokenValues,
  );

  updateState({
    token: accessToken,
    user: auth.user,
    merchantId,
    config,
    selectedTokenValue,
    tokenPlacements: {},
    walletBalance: deriveDisplayedWalletBalance(
      state.serverWalletBalance,
      {},
    ),
  });
  pendingPlayerTokenSubject =
    getTokenSubject(accessToken) || auth.user.id.trim();
  persistMerchantId(merchantId);
  scene.setResultDisplayDuration(COMPLETE_PHASE_DURATION_MS);

  await refreshPlayerData();
  authenticateGameSocket(socket, accessToken);
}

async function refreshConfig(): Promise<boolean> {
  if (!state.token) return false;
  if (hasPlayerSessionTimedOut()) {
    expirePlayerSessionForInactivity();
    return false;
  }
  try {
    const { data: config } = await api.fetchGameConfig(
      state.token,
      state.merchantId,
    );
    const tokenValues = normalizeTokenValues(config?.tokenValues);
    const selectedTokenValue = resolveSelectedTokenValue(
      state.selectedTokenValue,
      tokenValues,
    );
    updateState({ config, selectedTokenValue });
    scene.setResultDisplayDuration(COMPLETE_PHASE_DURATION_MS);
    return true;
  } catch (error) {
    console.warn('Config refresh failed', error);
    return false;
  }
}

async function refreshConfigForRoundStart(roundId: number) {
  let refreshedAtLeastOnce = false;
  for (let attempt = 0; attempt < CONFIG_REFRESH_RETRY_DELAYS_MS.length; attempt += 1) {
    if (!state.token) {
      return;
    }
    const waitMs = CONFIG_REFRESH_RETRY_DELAYS_MS[attempt] ?? 0;
    if (waitMs > 0) {
      await delay(waitMs);
    }
    const refreshed = await refreshConfig();
    if (!state.token) {
      return;
    }
    if (refreshed) refreshedAtLeastOnce = true;
  }
  if (!refreshedAtLeastOnce && state.token) {
    setStatus(
      `Failed to sync config for round ${roundId}. Using previous payout values.`,
      true,
    );
  }
}

async function handlePlaceHiLoBet(_side: BetSide) {
  throw new Error('Hi-Lo betting is disabled.');
}

async function handlePlaceDigitBet(selection: {
  digitType: DigitBetType;
  selection?: string;
}) {
  requireActivePlayerSession();
  const token = state.token;
  if (!token) {
    throw new Error(
      lastPlayerSessionExpiryMessage || 'You must login first.',
    );
  }
  if (!state.currentRound) {
    throw new Error('Waiting for next round to begin.');
  }
  if (state.currentRound.status !== 'BETTING') {
    throw new Error('Locked Phase');
  }
  if (new Date(state.currentRound.lockTime).getTime() <= Date.now()) {
    throw new Error('Locked Phase');
  }

  const tokenValue = state.selectedTokenValue;
  const amount = clampAmount(tokenValue, selection.digitType);
  if (amount !== tokenValue) {
    throw new Error(
      `Token value outside betting limits for ${getDigitBetLimitScopeLabel(selection.digitType)}`,
    );
  }
  if (state.serverWalletBalance < getTotalPlacedStake() + amount) {
    const message = 'Insufficient balance';
    setStatus(message, true);
    throw new Error(message);
  }

  try {
    const response = await api.placeBet(token, {
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
  requireActivePlayerSession();
  const token = state.token;
  if (!token) {
    throw new Error(
      lastPlayerSessionExpiryMessage || 'You must login first.',
    );
  }
  if (!state.currentRound) {
    throw new Error('Waiting for next round to begin.');
  }
  if (state.currentRound.status !== 'BETTING') {
    throw new Error('Locked Phase');
  }
  if (new Date(state.currentRound.lockTime).getTime() <= Date.now()) {
    throw new Error('Round already locked');
  }

  const roundId = state.currentRound.id;
  const res = await api.clearRoundBets(token, roundId);
  const serverWalletBalance = Number(res.data.walletBalance);
  const nextPlacements: Record<string, TokenPlacement> = {};

  updateState({
    serverWalletBalance,
    walletBalance: deriveDisplayedWalletBalance(
      serverWalletBalance,
      nextPlacements,
    ),
    tokenPlacements: nextPlacements,
    digitSelections: [],
  });
  scene.clearPlayerBets();

  await refreshPlayerData();
}

function getDigitBetLimitScopeLabel(digitType: DigitBetType) {
  switch (digitType) {
    case 'SMALL':
    case 'BIG':
      return 'SMALL/BIG';
    case 'ODD':
    case 'EVEN':
      return 'ODD/EVEN';
    case 'DOUBLE':
      return 'DOUBLE';
    case 'TRIPLE':
      return 'TRIPLE';
    case 'SUM':
      return 'SUM';
    case 'SINGLE':
      return 'SINGLE';
    case 'ANY_TRIPLE':
      return 'ANY_TRIPLE';
    default:
      return 'DIGIT';
  }
}

function resolveBetAmountLimit(digitType?: DigitBetType) {
  if (!state.config) {
    return null;
  }

  const fallback = {
    minBetAmount: state.config.minBetAmount,
    maxBetAmount: state.config.maxBetAmount,
  };
  if (!digitType || !state.config.digitBetAmountLimits) {
    return fallback;
  }

  const limits = state.config.digitBetAmountLimits;
  switch (digitType) {
    case 'SMALL':
    case 'BIG':
      return limits.smallBig ?? fallback;
    case 'ODD':
    case 'EVEN':
      return limits.oddEven ?? fallback;
    case 'DOUBLE':
      return limits.double ?? fallback;
    case 'TRIPLE':
      return limits.triple ?? fallback;
    case 'SUM':
      return limits.sum ?? fallback;
    case 'SINGLE':
      return limits.single ?? fallback;
    case 'ANY_TRIPLE':
      return limits.anyTriple ?? fallback;
    default:
      return fallback;
  }
}

function clampAmount(amount: number, digitType?: DigitBetType) {
  const limit = resolveBetAmountLimit(digitType);
  if (!limit) {
    return amount;
  }
  return Math.min(limit.maxBetAmount, Math.max(limit.minBetAmount, amount));
}

async function refreshPlayerData() {
  if (!state.token) return;
  if (hasPlayerSessionTimedOut()) {
    expirePlayerSessionForInactivity();
    return;
  }
  const requestId = ++playerDataRefreshRequestId;
  const token = state.token;
  const [walletRes, betsRes, roundsRes] = await Promise.all([
    api.fetchWallet(token),
    api.fetchPlayerHistory(token, 10),
    api.fetchRoundHistory(20),
  ]);
  if (requestId !== playerDataRefreshRequestId || state.token !== token) {
    return;
  }

  const latestCompletedRound =
    roundsRes.data.find((round) => Boolean(round.digitResult)) ?? null;
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
  const latestDigitResult = lastRoundResult?.digitResult ?? state.lastDigitResult;
  const latestDigitSum = lastRoundResult?.digitSum ?? state.lastDigitSum;

  const summaryRoundId = lastRoundResult?.roundId;
  const summaryBets =
    summaryRoundId && state.lastRoundBets.length && state.lastRoundBets[0]?.roundId === summaryRoundId
      ? state.lastRoundBets
      : summaryRoundId
        ? betsRes.data.filter((bet) => bet.roundId === summaryRoundId)
        : [];
  const lastRoundStake = summaryBets.reduce((sum, bet) => sum + bet.amount, 0);
  const lastRoundPayout = summaryBets.reduce((sum, bet) => sum + bet.payout, 0);
  const serverWalletBalance = Number(walletRes.data.balance);
  const walletBalance = deriveDisplayedWalletBalance(serverWalletBalance);

  updateState({
    serverWalletBalance,
    walletBalance,
    betHistory: betsRes.data,
    roundHistory: roundsRes.data,
    lastRoundResult,
    lastRoundStake,
    lastRoundPayout,
    lastDigitResult: latestDigitResult,
    lastDigitSum: latestDigitSum,
  });
  scene.setBalance(walletBalance);
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
        return 'Locked Phase';
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

function extractLaunchErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: unknown; errorMessage?: unknown }
      | undefined;
    if (typeof data?.message === 'string' && data.message.trim()) {
      return `Launch verification failed: ${data.message}`;
    }
    if (typeof data?.errorMessage === 'string' && data.errorMessage.trim()) {
      return `Launch verification failed: ${data.errorMessage}`;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return `Launch verification failed: ${error.message}`;
  }

  return 'Auto-launch authentication failed. Please login manually.';
}

function shouldLockAuthForLaunchError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  if (status !== 401 && status !== 403) {
    return false;
  }
  const data = error.response?.data as
    | { message?: unknown; errorMessage?: unknown }
    | undefined;
  const candidates = [data?.message, data?.errorMessage]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase());
  return candidates.some(
    (message) =>
      message.includes('disabled') || message.includes('blacklist'),
  );
}

function shouldLockAuthForBlockedLaunch(
  code: number | string | undefined,
  message: string | undefined,
): boolean {
  if (String(code) === '2003') {
    return true;
  }
  const normalized = (message ?? '').toLowerCase();
  return normalized.includes('disabled') || normalized.includes('blacklist');
}

// Keep the TypeScript compiler happy with the unused variable in some contexts.
void game;
