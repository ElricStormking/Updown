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
let roundSummaryMetaEl: HTMLElement | null = null;
let roundSummaryHiLoEl: HTMLElement | null = null;
let roundSummaryDigitsEl: HTMLElement | null = null;
let roundSummaryTotalEl: HTMLElement | null = null;
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
          <section class="round-summary">
            <h2>Round Summary</h2>
            <div class="round-summary-meta" id="round-summary-meta">
              Waiting for the first round result...
            </div>
            <div class="round-summary-section">
              <div class="round-summary-heading">Hi-Lo</div>
              <div class="round-summary-rows" id="round-summary-hilo"></div>
            </div>
            <div class="round-summary-section">
              <div class="round-summary-heading">Digit winners</div>
              <div class="round-summary-chips" id="round-summary-digits"></div>
            </div>
            <div class="round-summary-total" id="round-summary-total"></div>
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
  roundSummaryMetaEl = root.querySelector('#round-summary-meta');
  roundSummaryHiLoEl = root.querySelector('#round-summary-hilo');
  roundSummaryDigitsEl = root.querySelector('#round-summary-digits');
  roundSummaryTotalEl = root.querySelector('#round-summary-total');

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
  renderRoundSummary(nextState);
  refreshAuthScreen(nextState);
};

const renderRoundSummary = (nextState: typeof state) => {
  if (
    !roundSummaryMetaEl ||
    !roundSummaryHiLoEl ||
    !roundSummaryDigitsEl ||
    !roundSummaryTotalEl
  ) {
    return;
  }

  const lastResult = nextState.lastRoundResult;
  if (!lastResult) {
    roundSummaryMetaEl.textContent = 'Waiting for the first round result...';
    roundSummaryHiLoEl.innerHTML = '';
    roundSummaryDigitsEl.innerHTML = '';
    roundSummaryTotalEl.textContent = '';
    return;
  }

  const roundId = lastResult.roundId;
  const winningSide = lastResult.winningSide;
  const digitResult = lastResult.digitResult;
  const digitSum = lastResult.digitSum;

  const roundDetails = nextState.roundHistory.find((round) => round.id === roundId);
  const oddsUp = roundDetails?.oddsUp;
  const oddsDown = roundDetails?.oddsDown;

  const winnerLabel = winningSide ? `Hi-Lo: ${winningSide}` : 'Hi-Lo: PUSH';
  const digitLabel = digitResult ? `Digits: ${digitResult}` : 'Digits: ---';
  const sumLabel = typeof digitSum === 'number' ? `Sum: ${digitSum}` : 'Sum: --';
  roundSummaryMetaEl.textContent = `Round #${roundId} • ${winnerLabel} • ${digitLabel} • ${sumLabel}`;

  const betsForRound = nextState.betHistory.filter((bet) => bet.roundId === roundId);
  const hiloBets = betsForRound.filter((bet) => bet.betType === 'HILO');

  const sum = (items: number[]) => items.reduce((acc, value) => acc + value, 0);
  const sumStake = (side: BetSide) =>
    sum(hiloBets.filter((bet) => bet.side === side).map((bet) => bet.amount));
  const sumPayout = (side: BetSide) =>
    sum(hiloBets.filter((bet) => bet.side === side).map((bet) => bet.payout));

  const formatNet = (stake: number, payout: number) => {
    const net = payout - stake;
    const sign = net >= 0 ? '+' : '-';
    return `${sign}${Math.abs(net).toFixed(2)}`;
  };

  const upStake = sumStake('UP');
  const upPayout = sumPayout('UP');
  const downStake = sumStake('DOWN');
  const downPayout = sumPayout('DOWN');

  const renderSideRow = (side: BetSide, stake: number, payout: number, odds?: number) => {
    const isWinner = winningSide === side;
    const oddsLabel = typeof odds === 'number' ? `x${odds.toFixed(2)}` : 'x--';
    const details = stake > 0 || payout > 0
      ? `stake ${stake.toFixed(2)} → payout ${payout.toFixed(2)} (${formatNet(stake, payout)})`
      : 'no bet';
    return `
      <div class="round-summary-row${isWinner ? ' is-winner' : ''}">
        <span class="round-summary-side">${side} <span class="round-summary-odds">${oddsLabel}</span></span>
        <span class="round-summary-values">${details}</span>
      </div>
    `;
  };

  roundSummaryHiLoEl.innerHTML =
    renderSideRow('UP', upStake, upPayout, oddsUp) +
    renderSideRow('DOWN', downStake, downPayout, oddsDown);

  const digitWinners = getWinningDigitSummaries(
    digitResult,
    nextState.config?.digitPayouts,
  );
  roundSummaryDigitsEl.innerHTML = digitWinners.length
    ? digitWinners
        .map(
          (winner) =>
            `<span class="round-chip">${winner.label}<span class="round-chip-odds">${winner.odds}:1</span></span>`,
        )
        .join('')
    : '<span class="round-summary-muted">No digit result yet.</span>';

  const totalStake = nextState.lastRoundStake;
  const totalPayout = nextState.lastRoundPayout;
  const totalNet = totalPayout - totalStake;
  if (totalStake <= 0) {
    roundSummaryTotalEl.textContent = 'Your round: no bets placed';
  } else {
    const sign = totalNet >= 0 ? '+' : '-';
    roundSummaryTotalEl.textContent = `Your round: stake ${totalStake.toFixed(2)} payout ${totalPayout.toFixed(2)} (${sign}${Math.abs(totalNet).toFixed(2)})`;
  }
};

const getWinningDigitSummaries = (
  digitResult: string | null,
  payouts: typeof state.config extends { digitPayouts: infer P } ? P : any,
) => {
  const winners: Array<{ label: string; odds: number }> = [];
  if (!digitResult || !/^\d{3}$/.test(digitResult)) {
    return winners;
  }

  const resolvedPayouts = payouts ?? {
    smallBigOddEven: 0.96,
    anyTriple: 85,
    double: 23,
    triple: 700,
    single: {
      single: 2,
      double: 8,
      triple: 12,
    },
    sum: sumPayouts,
    ranges: {
      small: { min: 0, max: 13 },
      big: { min: 14, max: 27 },
      sumMin: 4,
      sumMax: 23,
    },
  };

  const digits = digitResult.split('');
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
  const uniqueDigits = Array.from(new Set(digits));

  if (isTriple) {
    winners.push({ label: 'ANY TRIPLE', odds: resolvedPayouts.anyTriple });
    winners.push({
      label: `TRIPLE ${digitResult}`,
      odds: resolvedPayouts.triple,
    });
    winners.push({
      label: `DOUBLE ${digits[0]}${digits[0]}`,
      odds: resolvedPayouts.double,
    });
    winners.push({
      label: `SINGLE ${digits[0]}`,
      odds: resolvedPayouts.single.triple,
    });
  } else {
    if (sum <= resolvedPayouts.ranges.small.max) {
      winners.push({ label: 'SMALL', odds: resolvedPayouts.smallBigOddEven });
    } else {
      winners.push({ label: 'BIG', odds: resolvedPayouts.smallBigOddEven });
    }

    winners.push({
      label: sum % 2 === 0 ? 'EVEN' : 'ODD',
      odds: resolvedPayouts.smallBigOddEven,
    });

    const doubleDigit = Object.keys(counts).find((digit) => counts[digit] >= 2);
    if (doubleDigit) {
      winners.push({
        label: `DOUBLE ${doubleDigit}${doubleDigit}`,
        odds: resolvedPayouts.double,
      });
    }

    uniqueDigits.forEach((digit) => {
      const count = counts[digit];
      const odds = count >= 2 ? resolvedPayouts.single.double : resolvedPayouts.single.single;
      winners.push({ label: `SINGLE ${digit}`, odds });
    });
  }

  if (sum >= resolvedPayouts.ranges.sumMin && sum <= resolvedPayouts.ranges.sumMax) {
    const sumOdds = resolvedPayouts.sum[sum];
    if (typeof sumOdds === 'number') {
      winners.push({ label: `SUM ${sum}`, odds: sumOdds });
    }
  }

  return winners;
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
