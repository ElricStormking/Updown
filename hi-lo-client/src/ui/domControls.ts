import { state, subscribe, updateState } from '../state/gameState';
import type { BetSide, DigitBetType } from '../types';

interface ControlHandlers {
  onLogin(credentials: { account: string; password: string }): Promise<void>;
  onPlaceBet(): Promise<void>;
  onPlaceDigitBet(selection: {
    digitType: DigitBetType;
    selection?: string;
  }): Promise<void>;
}

let statusEl: HTMLElement | null = null;
let phaseEl: HTMLElement | null = null;
let walletEl: HTMLElement | null = null;
let betListEl: HTMLElement | null = null;
let roundListEl: HTMLElement | null = null;
let amountInput: HTMLInputElement | null = null;
let upBtn: HTMLButtonElement | null = null;
let downBtn: HTMLButtonElement | null = null;
let digitTableEl: HTMLDivElement | null = null;
let digitResultEl: HTMLDivElement | null = null;
let digitResultDigits: HTMLSpanElement[] = [];
let digitResultSumEl: HTMLSpanElement | null = null;
let authScreenEl: HTMLDivElement | null = null;
let appShellEl: HTMLDivElement | null = null;
let authStatusEl: HTMLElement | null = null;

const sumPayouts: Record<number, number> = {
  4: 55,
  5: 40,
  6: 30,
  7: 22,
  8: 18,
  9: 15,
  10: 13,
  11: 11,
  12: 10,
  13: 10,
  14: 10,
  15: 10,
  16: 11,
  17: 13,
  18: 15,
  19: 18,
  20: 22,
  21: 30,
  22: 40,
  23: 55,
};

export const initControls = (handlers: ControlHandlers) => {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    throw new Error('Missing #app root');
  }

  root.innerHTML = `
    <div class="auth-screen" id="auth-screen">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="auth-chip">Hi-Lo BTC</span>
          <h1>Guess The Digits</h1>
          <p>Predict the last 3 digits and ride the next round.</p>
        </div>
        <form id="auth-form" class="auth-form">
          <label>Account <input type="text" name="account" required /></label>
          <label>Password <input type="password" name="password" required /></label>
          <button type="submit">Enter Arena</button>
        </form>
        <div class="status auth-status" id="auth-status">
          Enter demo credentials to start.
        </div>
      </div>
    </div>
    <div class="page-wrapper" id="app-shell">
      <div id="tradingview-chart"></div>
      <div class="layout">
        <div id="game-container"></div>
        <div class="control-panel">
          <div class="panel-meta">
            <div class="phase" id="phase-text"></div>
            <div class="wallet">
              Balance: <span id="wallet-balance">0</span> USDT
            </div>
          </div>
          <div class="status" id="status-text">Login to start betting.</div>
          <div class="bet-controls">
            <label>
              Bet Amount
              <input type="number" id="bet-amount" min="1" step="1" value="10" />
            </label>
            <div class="side-buttons">
              <button type="button" data-side="UP" class="side active">UP</button>
              <button type="button" data-side="DOWN" class="side">DOWN</button>
            </div>
            <button type="button" id="place-bet">Place Bet</button>
          </div>
          <section class="digit-bets">
            <h2>Digit Bets</h2>
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
              <div>Any Triple: 85:1</div>
              <div>Double: 23:1 each | Triple: 700:1 each</div>
              <div>Single digit: 2:1 single, 8:1 double, 12:1 triple</div>
            </div>
          </section>
          <section class="history-section history-section--bets">
            <h2>My Bets</h2>
            <ul id="bet-history"></ul>
          </section>
          <section class="history-section history-section--rounds">
            <h2>Recent Rounds</h2>
            <ul id="round-history"></ul>
          </section>
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
  amountInput = root.querySelector('#bet-amount');
  upBtn = root.querySelector('button[data-side="UP"]');
  downBtn = root.querySelector('button[data-side="DOWN"]');
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

  const betButton = root.querySelector<HTMLButtonElement>('#place-bet');
  betButton?.addEventListener('click', async () => {
    if (!state.token) {
      setStatus('Login before placing bets', true);
      return;
    }
    try {
      setStatus('Sending bet...');
      await handlers.onPlaceBet();
      setStatus('Bet placed!');
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Bet rejected',
        true,
      );
    }
  });

  amountInput?.addEventListener('input', () => {
    const nextValue = Number(amountInput?.value ?? 0);
    updateState({
      betAmount: Number.isFinite(nextValue) ? nextValue : state.betAmount,
    });
  });

  [upBtn, downBtn].forEach((button) => {
    button?.addEventListener('click', () => {
      const side = button.dataset.side as BetSide;
      updateState({ selectedSide: side });
      refreshSideButtons();
    });
  });

  if (digitTableEl) {
    digitTableEl.innerHTML = buildDigitBetTable();
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
};

const render = (nextState: typeof state) => {
  if (walletEl) {
    walletEl.textContent = nextState.walletBalance.toFixed(2);
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

  if (amountInput && document.activeElement !== amountInput) {
    amountInput.value = nextState.betAmount.toString();
  }

  renderHistoryLists(nextState);
  refreshSideButtons();
  refreshDigitHighlights(nextState);
  renderDigitResult(nextState);
  refreshAuthScreen(nextState);
};

const renderHistoryLists = (nextState: typeof state) => {
  if (betListEl) {
    betListEl.innerHTML = nextState.betHistory
      .slice(0, 10)
      .map(
        (bet) => {
          const label =
            bet.betType === 'DIGIT'
              ? `${bet.digitType ?? 'DIGIT'} ${bet.selection ?? ''}`.trim()
              : bet.side ?? 'HILO';
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
        (round) =>
          `<li>#${round.id} - ${round.winningSide ?? 'TBD'} - ${round.finalPrice ?? '?'}</li>`,
      )
      .join('');
  }
};

const refreshSideButtons = () => {
  [upBtn, downBtn].forEach((button) => {
    if (!button) return;
    button.classList.toggle('active', button.dataset.side === state.selectedSide);
  });
};

const refreshDigitHighlights = (nextState: typeof state) => {
  if (!digitTableEl) return;
  const roundId = nextState.currentRound?.id;
  const activeKeys = new Set(
    nextState.digitSelections
      .filter((item) => item.roundId === roundId)
      .map((item) => `${item.digitType}|${item.selection ?? ''}`),
  );
  const winningKeys = getWinningDigitKeys(
    nextState.lastDigitResult,
  );

  digitTableEl.querySelectorAll<HTMLButtonElement>('.digit-cell').forEach((cell) => {
    const digitType = cell.dataset.digitType;
    if (!digitType) return;
    const selection = cell.dataset.selection ?? '';
    const key = `${digitType}|${selection}`;
    cell.classList.toggle('digit-cell--active', activeKeys.has(key));
    cell.classList.toggle('digit-cell--winner', winningKeys.has(key));
  });
};

const renderDigitResult = (nextState: typeof state) => {
  if (!digitResultEl || digitResultDigits.length !== 3 || !digitResultSumEl) {
    return;
  }
  const digits = nextState.lastDigitResult;
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

const getWinningDigitKeys = (digitResult: string | null) => {
  const winners = new Set<string>();
  if (!digitResult || !/^\d{3}$/.test(digitResult)) {
    return winners;
  }

  const digits = digitResult.split('');
  const uniqueDigits = Array.from(new Set(digits));
  const counts: Record<string, number> = {
    '0': 0,
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    '6': 0,
    '7': 0,
    '8': 0,
    '9': 0,
  };
  let sum = 0;
  for (const digit of digits) {
    counts[digit] += 1;
    sum += Number(digit);
  }

  const isTriple = digits[0] === digits[1] && digits[1] === digits[2];
  const key = (digitType: string, selection = '') =>
    `${digitType}|${selection}`;

  if (isTriple) {
    winners.add(key('ANY_TRIPLE'));
    winners.add(key('TRIPLE', digitResult));
    winners.add(key('DOUBLE', `${digits[0]}${digits[0]}`));
    winners.add(key('SINGLE', digits[0]));
  } else {
    if (sum <= 13) {
      winners.add(key('SMALL'));
    } else {
      winners.add(key('BIG'));
    }
    winners.add(key(sum % 2 === 0 ? 'EVEN' : 'ODD'));

    const doubleDigit = Object.keys(counts).find((digit) => counts[digit] >= 2);
    if (doubleDigit) {
      winners.add(key('DOUBLE', `${doubleDigit}${doubleDigit}`));
    }

    uniqueDigits.forEach((digit) => {
      winners.add(key('SINGLE', digit));
    });
  }

  if (sum >= 4 && sum <= 23) {
    winners.add(key('SUM', String(sum)));
  }

  return winners;
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

  const sumValues = Array.from({ length: 20 }, (_, index) => index + 4);
  for (let row = 0; row < 4; row += 1) {
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
          const subLabel = cell.subLabel
            ? `<span class="digit-sub">${cell.subLabel}</span>`
            : '';
          const odds = cell.odds
            ? `<span class="digit-odds">${cell.odds}:1</span>`
            : '';
          return `
            <button type="button" class="digit-cell" data-digit-type="${cell.digitType}"${selectionAttr}>
              <span class="digit-label">${cell.label}</span>
              ${subLabel}
              ${odds}
            </button>
          `;
        })
        .join(''),
    )
    .join('');
};
