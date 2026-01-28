import { state, subscribe, updateState } from '../state/gameState';
import type { BetSide, DigitBetType } from '../types';
import { ensureCandlestickTradingViewWidget } from './candlestickTradingView';
import { LANGUAGES, setLanguage, t, type LanguageCode } from '../i18n';
import { api } from '../services/api';

interface ControlHandlers {
  onLogin(credentials: { account: string; password: string }): Promise<void>;
  onPlaceHiLoBet(side: BetSide): Promise<void>;
  onPlaceDigitBet(selection: {
    digitType: DigitBetType;
    selection?: string;
  }): Promise<void>;
  onClearTokens(): Promise<void>;
}

let statusEl: HTMLElement | null = null;
let phaseEl: HTMLElement | null = null;
let walletEl: HTMLElement | null = null;
let betListEl: HTMLElement | null = null;
let roundListEl: HTMLElement | null = null;
let upBtn: HTMLButtonElement | null = null;
let downBtn: HTMLButtonElement | null = null;
let digitTableEl: HTMLDivElement | null = null;
let digitResultEl: HTMLDivElement | null = null;
let digitResultDigits: HTMLSpanElement[] = [];
let digitResultSumEl: HTMLSpanElement | null = null;
let authScreenEl: HTMLDivElement | null = null;
let appShellEl: HTMLDivElement | null = null;
let authStatusEl: HTMLElement | null = null;
let tokenOptionsEl: HTMLDivElement | null = null;
let tokenOptionButtons: HTMLButtonElement[] = [];
let tokenBarMenuBtn: HTMLButtonElement | null = null;
let tokenBarClearBtn: HTMLButtonElement | null = null;
let statsDockEl: HTMLDivElement | null = null;
let statsDockTabBtn: HTMLButtonElement | null = null;
let statsDockPanelEl: HTMLDivElement | null = null;
let statsDockLast9El: HTMLDivElement | null = null;
let statsModalBackdropEl: HTMLDivElement | null = null;
let statsModalCloseBtn: HTMLButtonElement | null = null;
let statsLast9El: HTMLDivElement | null = null;
let statsLast16El: HTMLDivElement | null = null;
let statsSmallLabelEl: HTMLSpanElement | null = null;
let statsTripleLabelEl: HTMLSpanElement | null = null;
let statsBigLabelEl: HTMLSpanElement | null = null;
let statsSbtSmallEl: HTMLSpanElement | null = null;
let statsSbtTripleEl: HTMLSpanElement | null = null;
let statsSbtBigEl: HTMLSpanElement | null = null;
let menuModalBackdropEl: HTMLDivElement | null = null;
let menuModalCloseBtn: HTMLButtonElement | null = null;
let menuOpenStatsBtn: HTMLButtonElement | null = null;
let menuOpenSettingsBtn: HTMLButtonElement | null = null;
let menuOpenChartBtn: HTMLButtonElement | null = null;
let menuOpenBettingHistoryBtn: HTMLButtonElement | null = null;
let settingsModalBackdropEl: HTMLDivElement | null = null;
let settingsModalCloseBtn: HTMLButtonElement | null = null;
let settingsMusicToggleEl: HTMLInputElement | null = null;
let settingsSfxToggleEl: HTMLInputElement | null = null;
let settingsLanguageSelectEl: HTMLSelectElement | null = null;
let chartModalBackdropEl: HTMLDivElement | null = null;
let chartModalCloseBtn: HTMLButtonElement | null = null;
let bettingHistoryModalBackdropEl: HTMLDivElement | null = null;
let bettingHistoryModalCloseBtn: HTMLButtonElement | null = null;
let bettingHistoryPrevBtn: HTMLButtonElement | null = null;
let bettingHistoryNextBtn: HTMLButtonElement | null = null;
let bettingHistoryPageLabelEl: HTMLSpanElement | null = null;
let bettingHistoryListEl: HTMLDivElement | null = null;

const tokenStackByKey = new Map<string, HTMLElement>();
const TOKEN_VALUES = [10, 50, 100, 150, 200, 300, 500];
const TOKEN_BAR_FLOATING_CHIPS = [
  { value: 10, left: '21.7%', top: '58%' },
  { value: 100, left: '30.9%', top: '58%' },
  { value: 150, left: '40.2%', top: '58%' },
  { value: 200, left: '49.4%', top: '58%' },
  { value: 300, left: '58.7%', top: '58%' },
  { value: 50, left: '67.9%', top: '58%' },
  { value: 500, left: '77.2%', top: '58%' },
];

const WIN_CELEBRATE_FALLBACK_MS = 2600;
let lastWinCelebrateSignature: string | null = null;

const sumPayouts: Record<number, number> = {
  1: 130,
  2: 70,
  3: 40,
  4: 26,
  5: 18,
  6: 14,
  7: 12,
  8: 10,
  9: 9,
  10: 8,
  11: 8,
  12: 8,
  13: 7,
  14: 7,
  15: 8,
  16: 8,
  17: 8,
  18: 9,
  19: 10,
  20: 12,
  21: 14,
  22: 18,
  23: 26,
  24: 40,
  25: 70,
  26: 130,
};

const formatPayoutRatio = (value: number) => {
  if (!Number.isFinite(value)) return '--';
  const rounded = Math.round(value * 100) / 100;
  const asStr = rounded.toFixed(2).replace(/\.?0+$/, '');
  return `${asStr}:1`;
};

export const initControls = (handlers: ControlHandlers) => {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    throw new Error('Missing #app root');
  }

  let lastFocusBeforeModal: HTMLElement | null = null;

  const focusIfPossible = (el: HTMLElement | null | undefined) => {
    if (!el) return;
    if (!document.contains(el)) return;
    el.focus();
  };

  const moveFocusOutIfInside = (container: HTMLElement | null | undefined) => {
    if (!container) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    if (!container.contains(active)) return;

    // Blur first to avoid Chrome warning when toggling aria-hidden.
    active.blur();

    // Restore focus to where the user was before opening the modal, or fall back to the gear button.
    focusIfPossible(lastFocusBeforeModal);
    if (document.activeElement === document.body) {
      focusIfPossible(tokenBarMenuBtn ?? null);
    }
  };

  const openModal = (
    backdropEl: HTMLDivElement | null,
    open: boolean,
    focusOnOpen?: HTMLElement | null,
  ) => {
    if (!backdropEl) return;

    if (open) {
      const active = document.activeElement;
      lastFocusBeforeModal = active instanceof HTMLElement ? active : null;
    } else {
      moveFocusOutIfInside(backdropEl);
    }

    backdropEl.classList.toggle('is-open', open);
    backdropEl.setAttribute('aria-hidden', open ? 'false' : 'true');

    if (open) {
      requestAnimationFrame(() => focusIfPossible(focusOnOpen ?? null));
    }
  };

  root.innerHTML = `
    <div class="auth-screen" id="auth-screen">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="auth-chip">Hi-Lo BTC</span>
          <h1 data-i18n="auth.title"></h1>
          <p data-i18n="auth.subtitle"></p>
        </div>
        <form id="auth-form" class="auth-form">
          <label><span data-i18n="auth.account"></span> <input type="text" name="account" required /></label>
          <label><span data-i18n="auth.password"></span> <input type="password" name="password" required /></label>
          <button type="submit"><span data-i18n="auth.enter"></span></button>
        </form>
        <div class="status auth-status" id="auth-status">
          Enter demo credentials to start.
        </div>
      </div>
    </div>
    <div class="page-wrapper" id="app-shell">
      <div class="layout">
        <div id="game-container">
          <div id="tradingview-chart"></div>
          <div class="stats-dock" id="stats-dock">
            <button
              type="button"
              class="stats-dock-tab"
              id="stats-dock-tab"
              aria-expanded="false"
            >
              <span class="stats-dock-tab-text" data-i18n="stats.title"></span>
            </button>
            <div class="stats-dock-panel" id="stats-dock-panel" aria-hidden="true">
              <div class="stats-last9 stats-dock-last9" id="stats-dock-last9"></div>
            </div>
          </div>
        </div>
        <div class="control-panel">
          <div class="panel-meta">
            <div class="phase" id="phase-text"></div>
            <div class="wallet">
              Balance: <span id="wallet-balance">0</span> USDT
            </div>
          </div>
          <div class="status" id="status-text">Login to start betting.</div>
          <div class="bet-controls">
            <div class="token-bar">
              <div class="token-bar-header">
                <div class="token-bar-label" data-i18n="ui.tokenBar"></div>
                <button
                  type="button"
                  class="token-bar-menu"
                  id="token-bar-menu"
                  aria-label="Menu"
                  title="Menu"
                >
                  <span aria-hidden="true">⚙</span>
                </button>
              </div>
              <div class="token-options" id="token-options">
                ${TOKEN_VALUES.map(
                  (value) => `
                    <button type="button" class="token-option" data-token="${value}">
                      <span class="token-chip token-chip--${value}">${value}</span>
                    </button>
                  `,
                ).join('')}
              </div>
              <div class="token-bar-actions">
                <button
                  type="button"
                  class="token-bar-action-btn"
                  id="token-bar-clear"
                  aria-label="Clean tokens"
                  title="Clean tokens"
                >
                  <span aria-hidden="true">🧹</span>
                  <span class="token-bar-action-text" data-i18n="ui.cleanTokens"></span>
                </button>
              </div>
            </div>
            <div class="bet-hint" data-i18n="ui.tapToPlace"></div>
          </div>
          <section class="digit-bets">
            <h2 data-i18n="ui.digitBets"></h2>
            <div class="digit-result" id="digit-result">
              <span class="digit-result-label">Result</span>
              <div class="digit-result-digits">
                <span class="digit-result-digit">-</span>
                <span class="digit-result-digit">-</span>
                <span class="digit-result-digit">-</span>
              </div>
              <span class="digit-result-sum">Sum --</span>
            </div>
            <div class="digit-bet-table" id="digit-bet-table"></div>
            <div class="digit-bet-notes">
              <div>Small/Big/Odd/Even: 0.96:1 (lose on any triple)</div>
              <div>Any Triple: 40:1</div>
              <div>Double: 15:1 each | Triple: 400:1 each</div>
              <div>Single digit: 1:1 single, 8:1 double, 30:1 triple</div>
            </div>
          </section>
          <section class="history-section history-section--bets">
            <h2 data-i18n="ui.myBets"></h2>
            <ul id="bet-history"></ul>
          </section>
          <section class="history-section history-section--rounds">
            <h2 data-i18n="ui.recentRounds"></h2>
            <ul id="round-history"></ul>
          </section>
        </div>
      </div>
      <div class="token-bar-floating" id="token-bar-floating" aria-label="Token Bar">
        <img
          class="token-bar-floating-bg"
          src="/main_screen_UI/token_bar_box.png"
          alt="Token Bar"
        />
        ${TOKEN_BAR_FLOATING_CHIPS.map(
          (chip) => `
            <button
              type="button"
              class="token-bar-floating-chip"
              data-token="${chip.value}"
              style="left: ${chip.left}; top: ${chip.top};"
              aria-label="Token ${chip.value}"
            >
              <img src="/main_screen_UI/chip_${chip.value}.png" alt="" />
            </button>
          `,
        ).join('')}
        <button
          type="button"
          class="token-bar-floating-clear"
          id="token-bar-clear-floating"
          aria-label="Clean tokens"
          title="Clean tokens"
        >
          <img src="/main_screen_UI/token_bar_clean.png" alt="" />
        </button>
        <button
          type="button"
          class="token-bar-floating-menu"
          id="token-bar-menu-floating"
          aria-label="Menu"
          title="Menu"
        >
          <img src="/main_screen_UI/setting.png" alt="" />
        </button>
      </div>
    </div>
    <div class="stats-modal-backdrop" id="stats-modal-backdrop" aria-hidden="true">
      <div class="stats-modal" role="dialog" aria-modal="true" aria-label="Statistics">
        <div class="stats-modal-header">
          <div class="stats-modal-title" data-i18n="stats.title"></div>
          <button
            type="button"
            class="stats-modal-close"
            id="stats-modal-close"
            aria-label="Close statistics"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div class="stats-modal-body">
          <div class="stats-section">
            <div class="stats-section-title" data-i18n="stats.last9"></div>
            <div class="stats-last9" id="stats-last9"></div>
          </div>
          <div class="stats-section">
            <div class="stats-section-title" data-i18n="stats.last16"></div>
            <div class="stats-last16" id="stats-last16"></div>
          </div>
          <div class="stats-section">
            <div class="stats-section-title" data-i18n="stats.dist"></div>
            <div class="stats-sbt-row">
              <span class="stats-sbt-label stats-sbt-label--small" id="stats-small-label">SMALL --%</span>
              <span class="stats-sbt-label stats-sbt-label--triple" id="stats-triple-label">TRIPLE --%</span>
              <span class="stats-sbt-label stats-sbt-label--big" id="stats-big-label">BIG --%</span>
            </div>
            <div class="stats-sbt-bar" aria-label="Small/Triple/Big percentage bar">
              <span class="stats-sbt-seg stats-sbt-seg--small" id="stats-sbt-small"></span>
              <span class="stats-sbt-seg stats-sbt-seg--triple" id="stats-sbt-triple"></span>
              <span class="stats-sbt-seg stats-sbt-seg--big" id="stats-sbt-big"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="menu-modal-backdrop" id="menu-modal-backdrop" aria-hidden="true">
      <div class="menu-modal" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="menu-modal-header">
          <div class="menu-modal-title" data-i18n="menu.title"></div>
          <button
            type="button"
            class="menu-modal-close"
            id="menu-modal-close"
            aria-label="Close menu"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div class="menu-modal-body">
          <button type="button" class="menu-modal-item" id="menu-open-statistics">
            <span data-i18n="menu.statistics"></span>
          </button>
          <button type="button" class="menu-modal-item" id="menu-open-settings">
            <span data-i18n="menu.settings"></span>
          </button>
          <button type="button" class="menu-modal-item" id="menu-open-chart">
            <span data-i18n="menu.chart"></span>
          </button>
          <button type="button" class="menu-modal-item" id="menu-open-betting-history">
            <span data-i18n="menu.bettingHistory"></span>
          </button>
        </div>
      </div>
    </div>
    <div class="settings-modal-backdrop" id="settings-modal-backdrop" aria-hidden="true">
      <div class="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <div class="settings-modal-header">
          <div class="settings-modal-title" data-i18n="settings.title"></div>
          <button
            type="button"
            class="settings-modal-close"
            id="settings-modal-close"
            aria-label="Close settings"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div class="settings-modal-body">
          <label class="settings-row">
            <span class="settings-label" data-i18n="settings.music"></span>
            <input type="checkbox" class="settings-toggle" id="settings-music-toggle" checked />
          </label>
          <label class="settings-row">
            <span class="settings-label" data-i18n="settings.sounds"></span>
            <input type="checkbox" class="settings-toggle" id="settings-sfx-toggle" checked />
          </label>
          <label class="settings-row">
            <span class="settings-label" data-i18n="settings.language"></span>
            <select class="settings-select" id="settings-language-select">
              ${LANGUAGES.map((l) => `<option value="${l.code}">${l.label}</option>`).join('')}
            </select>
          </label>
        </div>
      </div>
    </div>
    <div class="chart-modal-backdrop" id="chart-modal-backdrop" aria-hidden="true">
      <div class="chart-modal" role="dialog" aria-modal="true" aria-label="Chart">
        <div class="chart-modal-header">
          <div class="chart-modal-title" data-i18n="chart.title"></div>
          <button
            type="button"
            class="chart-modal-close"
            id="chart-modal-close"
            aria-label="Close chart"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div class="chart-modal-body">
          <div class="chart-tv" id="chart-tv"></div>
        </div>
      </div>
    </div>
    <div class="betting-history-modal-backdrop" id="betting-history-modal-backdrop" aria-hidden="true">
      <div class="betting-history-modal" role="dialog" aria-modal="true" aria-label="Betting History">
        <div class="betting-history-modal-header">
          <div class="betting-history-modal-title" data-i18n="history.title"></div>
          <button
            type="button"
            class="betting-history-modal-close"
            id="betting-history-modal-close"
            aria-label="Close betting history"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div class="betting-history-modal-body">
          <div class="betting-history-list" id="betting-history-list"></div>
          <div class="betting-history-pager">
            <button type="button" class="betting-history-page-btn" id="betting-history-prev" aria-label="Prev page">
              ◀
            </button>
            <span class="betting-history-page-label" id="betting-history-page-label">1</span>
            <button type="button" class="betting-history-page-btn" id="betting-history-next" aria-label="Next page">
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  authScreenEl = root.querySelector('#auth-screen');
  appShellEl = root.querySelector('#app-shell');
  statusEl = root.querySelector('#status-text');
  authStatusEl = root.querySelector('#auth-status');
  phaseEl = root.querySelector('#phase-text');
  walletEl = root.querySelector('#wallet-balance');
  betListEl = root.querySelector('#bet-history');
  roundListEl = root.querySelector('#round-history');
  upBtn = root.querySelector('button[data-side="UP"]');
  downBtn = root.querySelector('button[data-side="DOWN"]');
  tokenOptionsEl = root.querySelector('#token-options');
  tokenBarMenuBtn =
    root.querySelector('#token-bar-menu-floating') ??
    root.querySelector('#token-bar-menu');
  tokenBarClearBtn =
    root.querySelector('#token-bar-clear-floating') ??
    root.querySelector('#token-bar-clear');
  statsDockEl = root.querySelector('#stats-dock');
  statsDockTabBtn = root.querySelector('#stats-dock-tab');
  statsDockPanelEl = root.querySelector('#stats-dock-panel');
  statsDockLast9El = root.querySelector('#stats-dock-last9');
  statsModalBackdropEl = root.querySelector('#stats-modal-backdrop');
  statsModalCloseBtn = root.querySelector('#stats-modal-close');
  statsLast9El = root.querySelector('#stats-last9');
  statsLast16El = root.querySelector('#stats-last16');
  statsSmallLabelEl = root.querySelector('#stats-small-label');
  statsTripleLabelEl = root.querySelector('#stats-triple-label');
  statsBigLabelEl = root.querySelector('#stats-big-label');
  statsSbtSmallEl = root.querySelector('#stats-sbt-small');
  statsSbtTripleEl = root.querySelector('#stats-sbt-triple');
  statsSbtBigEl = root.querySelector('#stats-sbt-big');
  menuModalBackdropEl = root.querySelector('#menu-modal-backdrop');
  menuModalCloseBtn = root.querySelector('#menu-modal-close');
  menuOpenStatsBtn = root.querySelector('#menu-open-statistics');
  menuOpenSettingsBtn = root.querySelector('#menu-open-settings');
  menuOpenChartBtn = root.querySelector('#menu-open-chart');
  menuOpenBettingHistoryBtn = root.querySelector('#menu-open-betting-history');
  settingsModalBackdropEl = root.querySelector('#settings-modal-backdrop');
  settingsModalCloseBtn = root.querySelector('#settings-modal-close');
  settingsMusicToggleEl = root.querySelector('#settings-music-toggle');
  settingsSfxToggleEl = root.querySelector('#settings-sfx-toggle');
  settingsLanguageSelectEl = root.querySelector('#settings-language-select');
  chartModalBackdropEl = root.querySelector('#chart-modal-backdrop');
  chartModalCloseBtn = root.querySelector('#chart-modal-close');
  bettingHistoryModalBackdropEl = root.querySelector('#betting-history-modal-backdrop');
  bettingHistoryModalCloseBtn = root.querySelector('#betting-history-modal-close');
  bettingHistoryPrevBtn = root.querySelector('#betting-history-prev');
  bettingHistoryNextBtn = root.querySelector('#betting-history-next');
  bettingHistoryPageLabelEl = root.querySelector('#betting-history-page-label');
  bettingHistoryListEl = root.querySelector('#betting-history-list');
  digitTableEl = root.querySelector('#digit-bet-table');
  digitResultEl = root.querySelector('#digit-result');
  digitResultDigits = Array.from(
    root.querySelectorAll('#digit-result .digit-result-digit'),
  );
  digitResultSumEl = root.querySelector('#digit-result .digit-result-sum');

  const authForm = root.querySelector<HTMLFormElement>('#auth-form');
  authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(authForm);
    const account = formData.get('account')?.toString() ?? '';
    const password = formData.get('password')?.toString() ?? '';
    try {
      setStatus('Signing in...');
      await handlers.onLogin({ account, password });
      setStatus('Authenticated. Waiting for round updates.');
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Login failed',
        true,
      );
    }
  });

  tokenOptionButtons = [
    ...Array.from(
      tokenOptionsEl?.querySelectorAll<HTMLButtonElement>('.token-option') ?? [],
    ),
    ...Array.from(
      root.querySelectorAll<HTMLButtonElement>('.token-bar-floating-chip') ?? [],
    ),
  ];
  tokenOptionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = Number(button.dataset.token ?? 0);
      if (!Number.isFinite(value) || value <= 0) {
        return;
      }
      updateState({ selectedTokenValue: value });
    });
  });

  const setStatsModalOpen = (open: boolean) => {
    openModal(statsModalBackdropEl, open, statsModalCloseBtn);
  };

  const setMenuModalOpen = (open: boolean) => {
    openModal(menuModalBackdropEl, open, menuModalCloseBtn);
  };

  const setSettingsModalOpen = (open: boolean) => {
    openModal(settingsModalBackdropEl, open, settingsModalCloseBtn);
  };

  const setChartModalOpen = (open: boolean) => {
    openModal(chartModalBackdropEl, open, chartModalCloseBtn);
  };

  const setBettingHistoryModalOpen = (open: boolean) => {
    openModal(
      bettingHistoryModalBackdropEl,
      open,
      bettingHistoryModalCloseBtn,
    );
  };

  const setStatsDockOpen = (open: boolean) => {
    if (!statsDockEl || !statsDockTabBtn || !statsDockPanelEl) return;
    statsDockEl.classList.toggle('is-open', open);
    statsDockTabBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    statsDockPanelEl.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  const loadBettingHistoryPage = async (page: number) => {
    if (!state.token) {
      setStatus('Login before viewing history', true);
      return;
    }
    const res = await api.fetchPlayerHistoryPaged(
      state.token,
      page,
      state.betHistoryPageSize,
    );
    updateState({
      betHistoryPage: res.data.page,
      betHistoryPageHasNext: res.data.hasNext,
      betHistoryPageItems: res.data.items,
    });
  };

  const toggleMenuModal = () => {
    if (!menuModalBackdropEl) return;
    setMenuModalOpen(!menuModalBackdropEl.classList.contains('is-open'));
  };

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

  const saveAudioSettings = (next: AudioSettings) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent('app:audio-settings', { detail: next }),
    );
  };

  const syncAudioTogglesFromStorage = () => {
    const current = loadAudioSettings();
    if (settingsMusicToggleEl) settingsMusicToggleEl.checked = current.musicEnabled;
    if (settingsSfxToggleEl) settingsSfxToggleEl.checked = current.sfxEnabled;
  };

  const syncLanguageSelectFromState = () => {
    if (settingsLanguageSelectEl) {
      settingsLanguageSelectEl.value = state.language;
    }
  };

  tokenBarMenuBtn?.addEventListener('click', () => {
    toggleMenuModal();
  });

  tokenBarClearBtn?.addEventListener('click', async () => {
    if (!tokenBarClearBtn || tokenBarClearBtn.disabled) return;
    try {
      setStatus('Cleaning tokens...');
      await handlers.onClearTokens();
      setStatus('Tokens cleared.');
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Failed to clear tokens',
        true,
      );
    }
  });

  // Floating "Statistics" side tab (top-left of the game canvas)
  statsDockTabBtn?.addEventListener('click', () => {
    const nextOpen = !statsDockEl?.classList.contains('is-open');
    setStatsDockOpen(Boolean(nextOpen));
  });

  // Menu modal wiring
  menuModalCloseBtn?.addEventListener('click', () => setMenuModalOpen(false));
  menuModalBackdropEl?.addEventListener('click', (event) => {
    if (event.target === menuModalBackdropEl) {
      setMenuModalOpen(false);
    }
  });
  menuOpenStatsBtn?.addEventListener('click', () => {
    setMenuModalOpen(false);
    setStatsModalOpen(true);
  });
  menuOpenSettingsBtn?.addEventListener('click', () => {
    setMenuModalOpen(false);
    syncAudioTogglesFromStorage();
    syncLanguageSelectFromState();
    setSettingsModalOpen(true);
  });
  menuOpenChartBtn?.addEventListener('click', () => {
    setMenuModalOpen(false);
    setChartModalOpen(true);

    // Lazy-load TradingView widget only when Chart is opened.
    setTimeout(() => {
      void ensureCandlestickTradingViewWidget('chart-tv').catch((error: unknown) =>
        console.error('TradingView chart failed to init', error),
      );
    }, 0);
  });
  menuOpenBettingHistoryBtn?.addEventListener('click', async () => {
    setMenuModalOpen(false);
    setBettingHistoryModalOpen(true);
    try {
      await loadBettingHistoryPage(0);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load history', true);
    }
  });

  // Stats modal wiring
  statsModalCloseBtn?.addEventListener('click', () => setStatsModalOpen(false));
  statsModalBackdropEl?.addEventListener('click', (event) => {
    if (event.target === statsModalBackdropEl) {
      setStatsModalOpen(false);
    }
  });

  // Settings modal wiring
  settingsModalCloseBtn?.addEventListener('click', () => setSettingsModalOpen(false));
  settingsModalBackdropEl?.addEventListener('click', (event) => {
    if (event.target === settingsModalBackdropEl) {
      setSettingsModalOpen(false);
    }
  });
  syncAudioTogglesFromStorage();
  settingsMusicToggleEl?.addEventListener('change', () => {
    const current = loadAudioSettings();
    saveAudioSettings({
      ...current,
      musicEnabled: Boolean(settingsMusicToggleEl?.checked),
    });
  });
  settingsSfxToggleEl?.addEventListener('change', () => {
    const current = loadAudioSettings();
    saveAudioSettings({
      ...current,
      sfxEnabled: Boolean(settingsSfxToggleEl?.checked),
    });
  });

  syncLanguageSelectFromState();
  settingsLanguageSelectEl?.addEventListener('change', () => {
    const next = (settingsLanguageSelectEl?.value ?? 'en') as LanguageCode;
    updateState({ language: next });
    setLanguage(next);
  });

  // Chart modal wiring
  chartModalCloseBtn?.addEventListener('click', () => setChartModalOpen(false));
  chartModalBackdropEl?.addEventListener('click', (event) => {
    if (event.target === chartModalBackdropEl) {
      setChartModalOpen(false);
    }
  });

  // Betting history modal wiring
  bettingHistoryModalCloseBtn?.addEventListener('click', () =>
    setBettingHistoryModalOpen(false),
  );
  bettingHistoryModalBackdropEl?.addEventListener('click', (event) => {
    if (event.target === bettingHistoryModalBackdropEl) {
      setBettingHistoryModalOpen(false);
    }
  });
  bettingHistoryPrevBtn?.addEventListener('click', async () => {
    const nextPage = Math.max(0, state.betHistoryPage - 1);
    if (nextPage === state.betHistoryPage) return;
    try {
      await loadBettingHistoryPage(nextPage);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load history', true);
    }
  });
  bettingHistoryNextBtn?.addEventListener('click', async () => {
    if (!state.betHistoryPageHasNext) return;
    try {
      await loadBettingHistoryPage(state.betHistoryPage + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load history', true);
    }
  });

  const repositionGameContainer = () => {
    const gameContainer = root.querySelector<HTMLDivElement>('#game-container');
    const layout = root.querySelector<HTMLDivElement>('.layout');
    const controlPanel = root.querySelector<HTMLDivElement>('.control-panel');
    const betControls = root.querySelector<HTMLDivElement>('.bet-controls');
    const betHint = root.querySelector<HTMLDivElement>('.bet-hint');
    if (!gameContainer || !layout || !controlPanel) {
      return;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 720;

    if (isMobile) {
      // Move the Phaser canvas above the bet hint in the stacked mobile layout.
      const isAlreadyInPlace =
        !!betControls &&
        !!betHint &&
        gameContainer.parentElement === betControls &&
        betHint.parentElement === betControls &&
        betHint.previousElementSibling === gameContainer;

      if (!isAlreadyInPlace) {
        if (betHint && betControls) {
          betHint.insertAdjacentElement('beforebegin', gameContainer);
        } else if (betControls) {
          betControls.appendChild(gameContainer);
        } else {
          layout.insertBefore(gameContainer, controlPanel);
        }
        window.dispatchEvent(new Event('app:layout:shown'));
      }
      return;
    }

    // Desktop/tablet: restore original layout (game left, panel right).
    if (gameContainer.parentElement !== layout) {
      layout.insertBefore(gameContainer, controlPanel);
      window.dispatchEvent(new Event('app:layout:shown'));
    }
  };

  repositionGameContainer();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', repositionGameContainer);
  }

  [upBtn, downBtn].forEach((button) => {
    button?.addEventListener('click', () => {
      setStatus('Hi-Lo betting is disabled.', true);
    });
  });

  if (digitTableEl) {
    digitTableEl.innerHTML = buildDigitBetTable();
    registerTokenStacks(root);
    digitTableEl.addEventListener('click', async (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        '.digit-cell',
      );
      if (!target) return;
      const digitType = target.dataset.digitType as DigitBetType | undefined;
      if (!digitType) return;
      const selection = target.dataset.selection || undefined;

      if (!state.token) {
        setStatus('Login before placing bets', true);
        return;
      }

      try {
        target.classList.add('digit-cell--flash');
        setTimeout(() => target.classList.remove('digit-cell--flash'), 250);
        setStatus('Sending digit bet...');
        await handlers.onPlaceDigitBet({ digitType, selection });
        setStatus('Digit bet placed!');
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : 'Bet rejected',
          true,
        );
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('app:open-settings', () => {
      openModal(settingsModalBackdropEl, true, settingsModalCloseBtn);
    });
  }

  subscribe(render);
  render(state);
};

export const setStatus = (message: string, isError = false) => {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', isError);
  }
  if (authStatusEl) {
    authStatusEl.textContent = message;
    authStatusEl.classList.toggle('error', isError);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app:status', { detail: { message, isError } }),
    );
  }
};

const celebrateWinningBetSlots = (nextState: typeof state) => {
  const settledRoundId = nextState.lastRoundBets[0]?.roundId ?? null;
  if (!settledRoundId) return;

  const durationMs = Math.max(
    0,
    Number(nextState.config?.resultDisplayDurationMs ?? WIN_CELEBRATE_FALLBACK_MS),
  );

  const digitWinKeys = nextState.lastRoundBets
    .filter((bet) => bet.betType === 'DIGIT' && bet.result === 'WIN' && bet.digitType)
    .map((bet) => `${bet.digitType}|${bet.selection ?? ''}`);

  const signature = `${settledRoundId}|${digitWinKeys.slice().sort().join(',')}`;
  if (signature === lastWinCelebrateSignature) return;
  lastWinCelebrateSignature = signature;

  // DIGIT cell celebration
  if (digitTableEl && digitWinKeys.length) {
    const set = new Set(digitWinKeys);
    digitTableEl.querySelectorAll<HTMLButtonElement>('.digit-cell').forEach((cell) => {
      const digitType = cell.dataset.digitType;
      if (!digitType) return;
      const selection = cell.dataset.selection ?? '';
      const key = `${digitType}|${selection}`;
      if (!set.has(key)) return;
      cell.classList.add('digit-cell--win-celebrate');
      setTimeout(
        () => cell.classList.remove('digit-cell--win-celebrate'),
        durationMs,
      );
    });
  }

  // Hi-Lo buttons are not used in this UI variant.
};

const render = (nextState: typeof state) => {
  applyI18n(nextState.language);
  if (walletEl) {
    walletEl.textContent = nextState.walletBalance.toFixed(2);
  }

  if (tokenBarClearBtn) {
    const round = nextState.currentRound;
    const hasPlacements = Object.keys(nextState.tokenPlacements ?? {}).length > 0;
    const isBetting =
      Boolean(nextState.token) &&
      Boolean(round) &&
      round.status === 'BETTING' &&
      new Date(round.lockTime).getTime() > Date.now();
    tokenBarClearBtn.disabled = !(isBetting && hasPlacements);
    tokenBarClearBtn.classList.toggle('is-disabled', tokenBarClearBtn.disabled);
  }

  if (phaseEl) {
    const round = nextState.currentRound;
    if (!round) {
      phaseEl.textContent = 'Phase: --';
    } else {
      const now = Date.now();
      const target = round.status === 'BETTING' ? round.lockTime : round.endTime;
      const remainingMs = Math.max(new Date(target).getTime() - now, 0);
      const remainingSec = Math.ceil(remainingMs / 1000);
      phaseEl.textContent = `Round #${round.id} - ${round.status} - ${remainingSec}s`;
    }
  }

  renderHistoryLists(nextState);
  renderStatistics(nextState);
  renderBettingHistory(nextState);
  refreshTokenSelection(nextState);
  refreshDigitHighlights(nextState);
  celebrateWinningBetSlots(nextState);
  renderTokenPlacements(nextState);
  renderDigitResult(nextState);
  updateDigitTableOdds(nextState);
  refreshAuthScreen(nextState);
};

let lastAppliedLanguage: LanguageCode | null = null;

const applyI18n = (lang: LanguageCode) => {
  if (lastAppliedLanguage === lang) return;
  lastAppliedLanguage = lang;

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    el.textContent = t(lang, key);
  });

  if (settingsLanguageSelectEl) {
    settingsLanguageSelectEl.value = lang;
  }

  // Keep the ⚙ a11y label in sync
  tokenBarMenuBtn?.setAttribute('aria-label', t(lang, 'ui.menu'));
  tokenBarMenuBtn?.setAttribute('title', t(lang, 'ui.menu'));

  // History modal title is data-i18n; but keep empty state localized too by rerender.
};

type SumBucket = 'SMALL' | 'BIG' | 'TRIPLE';

const isTripleDigits = (digitResult: string) =>
  digitResult.length === 3 &&
  digitResult[0] === digitResult[1] &&
  digitResult[1] === digitResult[2];

const classifySumBucket = (digitResult: string | null, digitSum: number | null): SumBucket | null => {
  if (!digitResult) return null;
  const trimmed = digitResult.trim();
  if (!trimmed) return null;

  if (isTripleDigits(trimmed)) return 'TRIPLE';

  let sum = digitSum;
  if (typeof sum !== 'number') {
    const parts = trimmed.split('').map((c) => Number(c));
    if (parts.some((n) => !Number.isFinite(n))) return null;
    sum = parts.reduce((acc, n) => acc + n, 0);
  }

  return sum <= 13 ? 'SMALL' : 'BIG';
};

const renderStatistics = (nextState: typeof state) => {
  const hasModalNodes =
    Boolean(statsLast9El) &&
    Boolean(statsLast16El) &&
    Boolean(statsSmallLabelEl) &&
    Boolean(statsTripleLabelEl) &&
    Boolean(statsBigLabelEl) &&
    Boolean(statsSbtSmallEl) &&
    Boolean(statsSbtTripleEl) &&
    Boolean(statsSbtBigEl);

  const completed = nextState.roundHistory.filter((r) => Boolean(r.digitResult));

  // 1) Last 9 rounds: sum on top, digits stacked under it.
  const last9 = completed.slice(0, 9).reverse();
  const last9Html = last9.length
    ? last9
        .map((round) => {
          const digits = (round.digitResult ?? '---').trim();
          const d0 = digits[0] ?? '-';
          const d1 = digits[1] ?? '-';
          const d2 = digits[2] ?? '-';
          const sumLabel =
            typeof round.digitSum === 'number' ? String(round.digitSum) : '--';

          return `
            <div class="stats-col" title="Round #${round.id}">
              <div class="stats-sum">${sumLabel}</div>
              <div class="stats-digit">${d0}</div>
              <div class="stats-digit">${d1}</div>
              <div class="stats-digit">${d2}</div>
            </div>
          `;
        })
        .join('')
    : '<div class="stats-empty">No digit results yet.</div>';

  if (statsDockLast9El) {
    statsDockLast9El.classList.toggle('stats-last9--empty', !last9.length);
    statsDockLast9El.innerHTML = last9Html;
  }

  if (!hasModalNodes) {
    return;
  }

  statsLast9El!.classList.toggle('stats-last9--empty', !last9.length);
  statsLast9El!.innerHTML = last9Html;

  // 2) Last 16 rounds: Sic-bo style "road" for Small / Big / Triple.
  const last16 = completed.slice(0, 16).reverse();
  const seq = last16
    .map((round) => ({
      roundId: round.id,
      bucket: classifySumBucket(round.digitResult, round.digitSum),
    }))
    .filter((item): item is { roundId: number; bucket: SumBucket } => Boolean(item.bucket));

  const buckets = seq.map((s) => s.bucket);

  const maxRows = 6;
  const occupied = new Set<string>();
  const placed = new Map<string, { bucket: SumBucket; roundId: number }>();
  let col = -1;
  let row = 0;
  let prev: SumBucket | null = null;
  let maxCol = 0;

  for (const item of seq) {
    if (prev === null || item.bucket !== prev) {
      col += 1;
      row = 0;
  } else {
      const downKey = `${row + 1},${col}`;
      const canGoDown = row + 1 < maxRows && !occupied.has(downKey);
      if (canGoDown) {
        row += 1;
    } else {
        col += 1;
        while (occupied.has(`${row},${col}`)) {
          col += 1;
        }
      }
    }

    const key = `${row},${col}`;
    occupied.add(key);
    placed.set(key, { bucket: item.bucket, roundId: item.roundId });
    prev = item.bucket;
    if (col > maxCol) maxCol = col;
  }

  const cols = Math.max(maxCol + 1, 1);
  if (!seq.length) {
    statsLast16El.classList.add('stats-last16--empty');
    statsLast16El.innerHTML = '<div class="stats-empty">No digit results yet.</div>';
  } else {
    statsLast16El.classList.remove('stats-last16--empty');
    const cells: string[] = [];
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < maxRows; r += 1) {
        const key = `${r},${c}`;
        const item = placed.get(key);
        if (!item) {
          cells.push('<div class="stats-road-cell stats-road-cell--empty"></div>');
          continue;
        }
        const letter =
          item.bucket === 'SMALL' ? 'S' : item.bucket === 'BIG' ? 'B' : 'T';
        const cls =
          item.bucket === 'SMALL'
            ? 'stats-bead--small'
            : item.bucket === 'BIG'
              ? 'stats-bead--big'
              : 'stats-bead--triple';
        cells.push(`
          <div class="stats-road-cell" title="Round #${item.roundId}">
            <div class="stats-bead ${cls}">${letter}</div>
          </div>
        `);
      }
    }
    statsLast16El.innerHTML = cells.join('');
  }

  // 3) Percent bar from last 16 buckets.
  const total = buckets.length;
  const small = buckets.filter((b) => b === 'SMALL').length;
  const big = buckets.filter((b) => b === 'BIG').length;
  const triple = buckets.filter((b) => b === 'TRIPLE').length;

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const smallPct = pct(small);
  const triplePct = pct(triple);
  const bigPct = Math.max(0, 100 - smallPct - triplePct); // keep sum at 100

  statsSmallLabelEl.textContent = `${t(nextState.language, 'stats.small')} ${smallPct}%`;
  statsTripleLabelEl.textContent = `${t(nextState.language, 'stats.triple')} ${triplePct}%`;
  statsBigLabelEl.textContent = `${t(nextState.language, 'stats.big')} ${bigPct}%`;

  statsSbtSmallEl.style.width = `${smallPct}%`;
  statsSbtTripleEl.style.width = `${triplePct}%`;
  statsSbtBigEl.style.width = `${bigPct}%`;
};

const getLocaleForLang = (lang: LanguageCode) => {
  switch (lang) {
    case 'zh':
      return 'zh-CN';
    case 'ms':
      return 'ms-MY';
    default:
      return 'en-US';
  }
};

const formatBetLabel = (nextState: typeof state, bet: { betType: string; side: string | null; digitType: string | null; selection: string | null }) => {
  if (bet.betType === 'HILO') {
    const side = bet.side === 'UP' ? t(nextState.language, 'hilo.up') : t(nextState.language, 'hilo.down');
    return `HILO ${side}`;
  }
  if (bet.betType === 'DIGIT') {
    const type = bet.digitType ?? 'DIGIT';
    const sel = bet.selection ? ` ${bet.selection}` : '';
    return `${type}${sel}`;
  }
  return bet.betType;
};

const renderBettingHistory = (nextState: typeof state) => {
  if (
    !bettingHistoryListEl ||
    !bettingHistoryPrevBtn ||
    !bettingHistoryNextBtn ||
    !bettingHistoryPageLabelEl
  ) {
    return;
  }

  bettingHistoryPrevBtn.disabled = nextState.betHistoryPage <= 0;
  bettingHistoryNextBtn.disabled = !nextState.betHistoryPageHasNext;
  bettingHistoryPageLabelEl.textContent = String(nextState.betHistoryPage + 1);

  const locale = getLocaleForLang(nextState.language);
  const rows = nextState.betHistoryPageItems.filter((bet) => bet.betType === 'DIGIT');
  if (!rows.length) {
    bettingHistoryListEl.innerHTML = `<div class="betting-history-empty">No history yet.</div>`;
    return;
  }

  bettingHistoryListEl.innerHTML = rows
    .map((bet) => {
      const date = new Date(bet.createdAt).toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const label = formatBetLabel(nextState, bet);
      const amount = bet.amount.toFixed(2);
      const payout = bet.payout.toFixed(2);
      const result = bet.result;

      return `
        <div class="betting-history-row">
          <div class="betting-history-top">
            <span class="betting-history-round">#${bet.roundId}</span>
            <span class="betting-history-date">${date}</span>
          </div>
          <div class="betting-history-mid">
            <span class="betting-history-type">${label}</span>
            <span class="betting-history-result betting-history-result--${result.toLowerCase()}">${result}</span>
          </div>
          <div class="betting-history-bottom">
            <span class="betting-history-amount">Bet: ${amount}</span>
            <span class="betting-history-payout">Payout: ${payout}</span>
          </div>
        </div>
      `;
    })
    .join('');
};

const renderHistoryLists = (nextState: typeof state) => {
  if (betListEl) {
    betListEl.innerHTML = nextState.betHistory
      .filter((bet) => bet.betType === 'DIGIT')
      .slice(0, 10)
      .map(
        (bet) => {
          const label = `${bet.digitType ?? 'DIGIT'} ${bet.selection ?? ''}`.trim();
          return `<li>#${bet.roundId} - ${label} - ${bet.amount.toFixed(
            2,
          )} - ${bet.result}</li>`;
        },
      )
      .join('');
  }

  if (roundListEl) {
    roundListEl.innerHTML = nextState.roundHistory
      .slice(0, 10)
      .map(
        (round) => {
          const digits = round.digitResult && /^\d{3}$/.test(round.digitResult)
            ? round.digitResult
            : '---';
          const sum = typeof round.digitSum === 'number' ? round.digitSum : '--';
          return `<li>#${round.id} - ${digits} (sum ${sum})</li>`;
        },
      )
      .join('');
  }
};

const refreshTokenSelection = (nextState: typeof state) => {
  if (!tokenOptionButtons.length) return;
  tokenOptionButtons.forEach((button) => {
    const value = Number(button.dataset.token ?? 0);
    button.classList.toggle('is-selected', value === nextState.selectedTokenValue);
  });
};

const refreshDigitHighlights = (nextState: typeof state) => {
  if (!digitTableEl) return;
  const roundId = nextState.currentRound?.id;
  const playerBets = nextState.digitSelections.filter(
    (item) => item.roundId === roundId,
  );
  const activeKeys = new Set(
    playerBets.map((item) => `${item.digitType}|${item.selection ?? ''}`),
  );

  // Winner highlights come from server-settled bet results (no client-side rule logic).
  const winnerKeys = new Set(
    nextState.lastRoundBets
      .filter((bet) => bet.betType === 'DIGIT' && bet.result === 'WIN' && bet.digitType)
      .map((bet) => `${bet.digitType}|${bet.selection ?? ''}`),
  );

  const getLatestDigitResult = () => {
    const fromHistory =
      nextState.roundHistory.find(
        (r) => typeof r.digitResult === 'string' && /^\d{3}$/.test(r.digitResult),
      ) ?? null;
    return nextState.lastDigitResult ?? fromHistory?.digitResult ?? null;
  };

  const getResultKeys = () => {
    const digits = getLatestDigitResult();
    if (!digits || !/^\d{3}$/.test(digits)) return new Set<string>();

    const parts = digits.split('');
    const counts = new Map<string, number>();
    for (const d of parts) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }

    const sum =
      typeof nextState.lastDigitSum === 'number'
        ? nextState.lastDigitSum
        : parts.reduce((acc, d) => acc + Number(d), 0);
    const isTriple = digits[0] === digits[1] && digits[1] === digits[2];

    const keys = new Set<string>();

    // Always highlight the three digits (SINGLE).
    for (const d of parts) {
      keys.add(`SINGLE|${d}`);
    }

    // Highlight doubles/triple if present.
    for (const [d, count] of counts.entries()) {
      if (count >= 2) keys.add(`DOUBLE|${d}${d}`);
    }
    if (isTriple) {
      keys.add(`ANY_TRIPLE|`);
      keys.add(`TRIPLE|${digits}`);
    }

    // SUM always highlights if within table range.
    if (Number.isFinite(sum) && sum >= 1 && sum <= 26) {
      keys.add(`SUM|${sum}`);
    }

    // Small/Big/Odd/Even are only winners when not a triple in our payout rules,
    // but we still frame them to show the round's derived categories.
    if (!isTriple && Number.isFinite(sum)) {
      keys.add(sum <= 13 ? `SMALL|` : `BIG|`);
      keys.add(sum % 2 === 0 ? `EVEN|` : `ODD|`);
    }

    return keys;
  };

  const resultKeys = getResultKeys();

  const bonusSlots = nextState.currentRound?.digitBonus?.slots ?? [];
  const bonusMap = new Map<string, number | null>();
  bonusSlots.forEach((slot) => {
    const key = `${slot.digitType}|${slot.selection ?? ''}`;
    const ratio =
      typeof slot.bonusRatio === 'number' && Number.isFinite(slot.bonusRatio)
        ? slot.bonusRatio
        : null;
    bonusMap.set(key, ratio);
  });
  const nextBonusSignature = Array.from(bonusMap.entries())
    .map(([key, ratio]) => `${key}:${ratio ?? ''}`)
    .sort()
    .join(',');
  const bonusChanged = nextBonusSignature !== lastBonusSignature;
  if (bonusChanged) {
    lastBonusSignature = nextBonusSignature;
  }

  digitTableEl.querySelectorAll<HTMLButtonElement>('.digit-cell').forEach((cell) => {
    const digitType = cell.dataset.digitType;
    if (!digitType) return;
    const selection = cell.dataset.selection ?? '';
    const key = `${digitType}|${selection}`;
    cell.classList.toggle('digit-cell--active', activeKeys.has(key));
    cell.classList.toggle('digit-cell--winner', winnerKeys.has(key));
    cell.classList.toggle('digit-cell--result', resultKeys.has(key));
    const bonusRatio = bonusMap.get(key);
    const isBonus = bonusMap.has(key);
    cell.classList.toggle('digit-cell--bonus', isBonus);

    const bonusOddsEl = cell.querySelector<HTMLElement>('.digit-bonus-odds');
    if (bonusOddsEl) {
      if (isBonus) {
        bonusOddsEl.textContent =
          typeof bonusRatio === 'number' && Number.isFinite(bonusRatio)
            ? formatPayoutRatio(bonusRatio)
            : '';
      } else {
        bonusOddsEl.textContent = '';
      }
    }

    if (bonusChanged && isBonus) {
      cell.classList.add('digit-cell--bonus-pop');
      setTimeout(() => cell.classList.remove('digit-cell--bonus-pop'), 1100);
    }
  });
};

let lastBonusSignature: string | null = null;

const updateDigitTableOdds = (nextState: typeof state) => {
  if (!digitTableEl) return;
  const payouts = nextState.config?.digitPayouts;
  digitTableEl
    .querySelectorAll<HTMLButtonElement>('.digit-cell[data-digit-type="SUM"]')
    .forEach((cell) => {
      const selection = cell.dataset.selection;
      if (!selection) return;
      const key = Number(selection);
      if (!Number.isFinite(key)) return;
      const oddsValue = payouts?.sum?.[key] ?? sumPayouts[key];
      const oddsEl = cell.querySelector<HTMLElement>('.digit-odds');
      if (!oddsEl) return;
      oddsEl.textContent = Number.isFinite(oddsValue)
        ? formatPayoutRatio(oddsValue)
        : '--';
  });
};

const renderTokenPlacements = (nextState: typeof state) => {
  if (!tokenStackByKey.size) return;
  tokenStackByKey.forEach((stackEl, key) => {
    const placement = nextState.tokenPlacements?.[key];
    renderTokenStack(stackEl, placement);
  });
};

const renderTokenStack = (
  stackEl: HTMLElement,
  placement?: { value: number; count: number },
) => {
  if (!placement) {
    stackEl.innerHTML = '';
    stackEl.classList.remove('has-tokens');
    return;
  }
  const totalAmount = placement.value * placement.count;
  const amountLabel = String(totalAmount);
  const compactClass = amountLabel.length >= 4 ? ' token-chip--compact' : '';
  stackEl.innerHTML = `
    <span class="token-chip token-chip--${placement.value}${compactClass}">
      ${amountLabel}
    </span>
  `;
  stackEl.classList.add('has-tokens');
};

const registerTokenStacks = (root: HTMLElement) => {
  tokenStackByKey.clear();
  root.querySelectorAll<HTMLElement>('[data-bet-key]').forEach((betEl) => {
    const key = betEl.dataset.betKey;
    if (!key) return;
    const stackEl = betEl.querySelector<HTMLElement>('.token-stack');
    if (!stackEl) return;
    tokenStackByKey.set(key, stackEl);
  });
};

const renderDigitResult = (nextState: typeof state) => {
  if (!digitResultEl || digitResultDigits.length !== 3 || !digitResultSumEl) {
    return;
  }

  // Prefer live socket payload; fall back to the latest completed round so this never goes blank.
  const fallbackFromHistory =
    nextState.roundHistory.find((r) => typeof r.digitResult === 'string' && /^\d{3}$/.test(r.digitResult))
      ?.digitResult ?? null;
  const digits = nextState.lastDigitResult ?? fallbackFromHistory;

  if (!digits || !/^\d{3}$/.test(digits)) {
    digitResultDigits.forEach((digitEl) => {
      digitEl.textContent = '-';
    });
    digitResultSumEl.textContent = 'Sum --';
    return;
  }
  const sum = digits.split('').reduce((total, char) => total + Number(char), 0);
  digits.split('').forEach((digit, index) => {
    if (digitResultDigits[index]) {
      digitResultDigits[index].textContent = digit;
    }
  });
  digitResultSumEl.textContent = `Sum ${sum}`;
};

const refreshAuthScreen = (nextState: typeof state) => {
  if (!authScreenEl || !appShellEl) return;
  const isAuthed = Boolean(nextState.token);
  const wasHidden = authScreenEl.classList.contains('is-hidden');
  authScreenEl.classList.toggle('is-hidden', isAuthed);
  appShellEl.classList.toggle('is-hidden', !isAuthed);
  if (isAuthed && !wasHidden) {
    window.dispatchEvent(new Event('app:layout:shown'));
  }
};

const buildDigitBetTable = () => {
  const rows: Array<
    Array<{
      label: string;
      digitType: DigitBetType;
      selection?: string;
      subLabel?: string;
      odds?: number;
    }>
  > = [];

  rows.push([
    { label: 'SMALL', subLabel: '0-13', digitType: 'SMALL' },
    { label: 'ODD', digitType: 'ODD' },
    { label: 'ANY TRIPLE', digitType: 'ANY_TRIPLE' },
    { label: 'EVEN', digitType: 'EVEN' },
    { label: 'BIG', subLabel: '14-27', digitType: 'BIG' },
  ]);

  rows.push(['0', '1', '2', '3', '4'].map((value) => ({
    label: value,
    digitType: 'SINGLE',
    selection: value,
  })));
  rows.push(['5', '6', '7', '8', '9'].map((value) => ({
    label: value,
    digitType: 'SINGLE',
    selection: value,
  })));

  rows.push(['00', '11', '22', '33', '44'].map((value) => ({
    label: value,
    digitType: 'DOUBLE',
    selection: value,
  })));
  rows.push(['55', '66', '77', '88', '99'].map((value) => ({
    label: value,
    digitType: 'DOUBLE',
    selection: value,
  })));

  rows.push(['000', '111', '222', '333', '444'].map((value) => ({
    label: value,
    digitType: 'TRIPLE',
    selection: value,
  })));
  rows.push(['555', '666', '777', '888', '999'].map((value) => ({
    label: value,
    digitType: 'TRIPLE',
    selection: value,
  })));

  const sumValues = Array.from({ length: 26 }, (_, index) => index + 1);
  const sumRows = Math.ceil(sumValues.length / 5);
  for (let row = 0; row < sumRows; row += 1) {
    const rowValues = sumValues.slice(row * 5, row * 5 + 5);
    rows.push(
      rowValues.map((value) => ({
        label: String(value),
        digitType: 'SUM',
        selection: String(value),
        odds: sumPayouts[value],
      })),
    );
  }

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const selectionAttr = cell.selection
            ? ` data-selection="${cell.selection}"`
            : '';
          const selectionKey = cell.selection ?? '';
          const betKeyAttr = ` data-bet-key="DIGIT|${cell.digitType}|${selectionKey}"`;
          const subLabel = cell.subLabel
            ? `<span class="digit-sub">${cell.subLabel}</span>`
            : '';
          const odds = cell.odds
            ? `<span class="digit-odds">${cell.odds}:1</span>`
            : '';
          return `
            <button type="button" class="digit-cell bet-space" data-digit-type="${cell.digitType}"${selectionAttr}${betKeyAttr}>
              <span class="digit-label">${cell.label}</span>
              ${subLabel}
              ${odds}
              <span class="digit-bonus-badge" aria-hidden="true">BONUS</span>
              <span class="digit-bonus-odds" aria-hidden="true"></span>
              <span class="token-stack"></span>
            </button>
          `;
        })
        .join(''),
    )
    .join('');
};
