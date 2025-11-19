import { state, subscribe, updateState } from '../state/gameState';
import type { BetSide } from '../types';

interface ControlHandlers {
  onLogin(credentials: { email: string; password: string }): Promise<void>;
  onPlaceBet(): Promise<void>;
}

let statusEl: HTMLElement | null = null;
let walletEl: HTMLElement | null = null;
let betListEl: HTMLElement | null = null;
let roundListEl: HTMLElement | null = null;
let amountInput: HTMLInputElement | null = null;
let upBtn: HTMLButtonElement | null = null;
let downBtn: HTMLButtonElement | null = null;

export const initControls = (handlers: ControlHandlers) => {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    throw new Error('Missing #app root');
  }

  root.innerHTML = `
    <div class="layout">
      <div id="game-container"></div>
      <div class="control-panel">
        <h1>Hi-Lo BTC Prototype</h1>
        <form id="auth-form">
          <label>Email <input type="email" name="email" required /></label>
          <label>Password <input type="password" name="password" required /></label>
          <button type="submit">Login</button>
        </form>
        <div class="status" id="status-text">Enter demo credentials to start.</div>
        <div class="wallet">
          Balance: <span id="wallet-balance">0</span> USDT
        </div>
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
        <section>
          <h2>My Bets</h2>
          <ul id="bet-history"></ul>
        </section>
        <section>
          <h2>Recent Rounds</h2>
          <ul id="round-history"></ul>
        </section>
      </div>
    </div>
  `;

  statusEl = root.querySelector('#status-text');
  walletEl = root.querySelector('#wallet-balance');
  betListEl = root.querySelector('#bet-history');
  roundListEl = root.querySelector('#round-history');
  amountInput = root.querySelector('#bet-amount');
  upBtn = root.querySelector('button[data-side="UP"]');
  downBtn = root.querySelector('button[data-side="DOWN"]');

  const authForm = root.querySelector<HTMLFormElement>('#auth-form');
  authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(authForm);
    const email = formData.get('email')?.toString() ?? '';
    const password = formData.get('password')?.toString() ?? '';
    try {
      setStatus('Signing in...');
      await handlers.onLogin({ email, password });
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

  subscribe(render);
  render(state);
};

export const setStatus = (message: string, isError = false) => {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', isError);
  }
};

const render = (nextState: typeof state) => {
  if (walletEl) {
    walletEl.textContent = nextState.walletBalance.toFixed(2);
  }

  if (amountInput && document.activeElement !== amountInput) {
    amountInput.value = nextState.betAmount.toString();
  }

  renderHistoryLists(nextState);
  refreshSideButtons();
};

const renderHistoryLists = (nextState: typeof state) => {
  if (betListEl) {
    betListEl.innerHTML = nextState.betHistory
      .slice(0, 10)
      .map(
        (bet) =>
          `<li>#${bet.roundId} - ${bet.side} - ${bet.amount.toFixed(
            2,
          )} → ${bet.result}</li>`,
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

