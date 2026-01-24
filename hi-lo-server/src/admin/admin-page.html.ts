export const ADMIN_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Tools</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap");
      :root {
        color-scheme: dark;
        --bg: #0b0f16;
        --bg-strong: #0f1622;
        --panel: rgba(15, 23, 42, 0.86);
        --panel-strong: #0f172a;
        --text: #e2e8f0;
        --muted: #9aa4b2;
        --accent: #38bdf8;
        --accent-strong: #0ea5e9;
        --accent-soft: #0b2333;
        --border: #1f2a3a;
        --shadow: 0 24px 60px rgba(3, 6, 10, 0.65);
        --radius: 18px;
        --radius-sm: 12px;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", Tahoma, Arial, sans-serif;
        background: radial-gradient(1100px circle at 12% -18%, rgba(56, 189, 248, 0.08) 0%, transparent 50%),
          radial-gradient(900px circle at 90% -12%, rgba(15, 118, 110, 0.12) 0%, transparent 55%),
          linear-gradient(180deg, var(--bg) 0%, var(--bg-strong) 100%);
        color: var(--text);
        min-height: 100vh;
      }
      .page { max-width: 1400px; margin: 0 auto; padding: 1.5rem 1.5rem 3.5rem; }
      header {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
        margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);
      }
      h1 { font-family: "Fraunces", serif; font-size: 1.9rem; margin: 0; }
      .tagline { color: var(--muted); font-size: 0.9rem; margin-top: 0.35rem; }
      .toolbar { display: flex; gap: 0.6rem; align-items: center; }
      button {
        cursor: pointer; border: 1px solid var(--border); background: var(--panel-strong);
        color: var(--text); padding: 0.55rem 1.1rem; border-radius: 999px;
        font-weight: 600; font-size: 0.92rem;
        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
      }
      button:hover:not(:disabled) {
        transform: translateY(-1px); box-shadow: 0 10px 24px rgba(3, 6, 10, 0.6);
        border-color: rgba(56, 189, 248, 0.35);
      }
      button.primary {
        background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
        border-color: transparent; color: #04111f;
      }
      button.secondary { background: transparent; }
      button:disabled { opacity: 0.6; cursor: not-allowed; }
      button.small { padding: 0.35rem 0.75rem; font-size: 0.82rem; }
      .section {
        background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
        padding: 1.4rem 1.35rem; margin-bottom: 1.25rem; box-shadow: var(--shadow);
      }
      .section h2 { margin: 0 0 1rem 0; font-size: 1.2rem; font-family: "Fraunces", serif; }
      .hidden { display: none !important; }
      .status { margin-top: 0.6rem; font-size: 0.9rem; color: var(--muted); }
      .status.error { color: #f87171; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.9rem 1.1rem; }
      label { display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.82rem; color: var(--muted); }
      input, select {
        padding: 0.55rem 0.7rem; border-radius: var(--radius-sm); border: 1px solid var(--border);
        font-size: 0.95rem; background: #0b1320; color: var(--text);
      }
      input:focus, select:focus {
        outline: none; border-color: rgba(56, 189, 248, 0.7);
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.16);
      }
      .form-actions { display: flex; gap: 0.6rem; margin-top: 1rem; flex-wrap: wrap; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid var(--border); text-align: left; padding: 0.65rem 0.45rem; font-size: 0.85rem; }
      th { color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.72rem; }
      tbody tr:hover { background: #0e1826; }
      .table-wrapper { overflow-x: auto; }

      /* Tabs */
      .tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; }
      .tab-btn {
        padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
        background: transparent; color: var(--muted); font-size: 0.85rem; font-weight: 500;
        cursor: pointer; transition: all 0.15s ease;
      }
      .tab-btn:hover { background: var(--panel-strong); color: var(--text); }
      .tab-btn.active {
        background: var(--accent-soft); border-color: var(--accent); color: var(--accent);
      }
      .tab-content { display: none; }
      .tab-content.active { display: block; }

      /* Pagination */
      .pagination { display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem; justify-content: flex-end; }
      .pagination button { padding: 0.4rem 0.8rem; font-size: 0.85rem; }
      .pagination span { color: var(--muted); font-size: 0.85rem; }

      /* Filters */
      .filters { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end; margin-bottom: 1rem; }
      .filters label { min-width: 140px; }
      .filters input, .filters select { min-width: 120px; }

      /* Badge */
      .badge {
        display: inline-block; padding: 0.2rem 0.5rem; border-radius: 999px;
        font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
      }
      .badge.success { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
      .badge.warning { background: rgba(234, 179, 8, 0.2); color: #facc15; }
      .badge.error { background: rgba(239, 68, 68, 0.2); color: #f87171; }
      .badge.info { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }

      @media (max-width: 760px) {
        header { flex-direction: column; }
        .tabs { overflow-x: auto; flex-wrap: nowrap; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <div>
          <h1>Admin Tools</h1>
          <div class="tagline">Data management and game configuration.</div>
        </div>
        <div class="toolbar">
          <button id="logout-btn" class="secondary hidden" type="button">Logout</button>
        </div>
      </header>

      <!-- Login Section -->
      <section class="section" id="login-section">
        <h2>Admin Login</h2>
        <form id="login-form">
          <div class="grid">
            <label>Account<input id="login-account" type="text" autocomplete="username" required /></label>
            <label>Password<input id="login-password" type="password" autocomplete="current-password" required /></label>
          </div>
          <div class="form-actions"><button class="primary" type="submit">Login</button></div>
          <div class="status" id="login-status"></div>
        </form>
      </section>

      <!-- Main Content (hidden until logged in) -->
      <div id="main-content" class="hidden">
        <!-- Tabs Navigation -->
        <div class="tabs" id="tabs">
          <button class="tab-btn active" data-tab="config">Game Config</button>
          <button class="tab-btn" data-tab="rtp">Daily RTP</button>
          <button class="tab-btn" data-tab="rounds">Rounds</button>
          <button class="tab-btn" data-tab="bets">Bets</button>
          <button class="tab-btn" data-tab="players">Players</button>
          <button class="tab-btn" data-tab="merchants">Merchants</button>
          <button class="tab-btn" data-tab="transfers">Transfers</button>
          <button class="tab-btn" data-tab="transactions">Transactions</button>
        </div>

        <!-- Game Config Tab -->
        <div class="tab-content active" id="tab-config">
          <section class="section">
            <h2>Game Configuration</h2>
            <form id="config-form">
              <div class="grid">
                <label>Betting duration (ms)<input id="cfg-betting-duration" type="number" min="0" step="100" /></label>
                <label>Result duration (ms)<input id="cfg-result-duration" type="number" min="0" step="100" /></label>
                <label>Result display (ms)<input id="cfg-result-display-duration" type="number" min="0" step="100" /></label>
                <label>Snapshot interval (ms)<input id="cfg-snapshot-interval" type="number" min="1" step="100" /></label>
                <label>Bonus slot total<input id="cfg-bonus-slot-total" type="number" min="1" step="1" /></label>
                <label>Min bet<input id="cfg-min-bet" type="number" min="0" step="0.01" /></label>
                <label>Max bet<input id="cfg-max-bet" type="number" min="0" step="0.01" /></label>
                <label>Payout up<input id="cfg-payout-up" type="number" min="0" step="0.01" /></label>
                <label>Payout down<input id="cfg-payout-down" type="number" min="0" step="0.01" /></label>
              </div>
              <div class="form-actions">
                <button type="button" id="config-reload">Reload</button>
                <button class="primary" type="submit">Save</button>
              </div>
              <div class="status" id="config-status"></div>
            </form>
          </section>
        </div>

        <!-- Daily RTP Tab -->
        <div class="tab-content" id="tab-rtp">
          <section class="section">
            <h2>Daily RTP</h2>
            <form id="rtp-form" class="filters">
              <label>Start<input id="rtp-start" type="date" /></label>
              <label>End<input id="rtp-end" type="date" /></label>
              <button class="primary" type="submit">Load</button>
            </form>
            <div class="status" id="rtp-status"></div>
            <div class="table-wrapper">
              <table>
                <thead><tr><th>Date</th><th>Bets</th><th>Stake</th><th>Payout</th><th>Net</th><th>RTP</th></tr></thead>
                <tbody id="rtp-table-body"></tbody>
              </table>
            </div>
          </section>
        </div>

        <!-- Rounds Tab -->
        <div class="tab-content" id="tab-rounds">
          <section class="section">
            <h2>Game Rounds</h2>
            <form id="rounds-form" class="filters">
              <label>Round ID<input id="rounds-id" type="number" /></label>
              <label>Status
                <select id="rounds-status">
                  <option value="">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="BETTING">Betting</option>
                  <option value="RESULT_PENDING">Result Pending</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </label>
              <label>Start<input id="rounds-start" type="date" /></label>
              <label>End<input id="rounds-end" type="date" /></label>
              <button class="primary" type="submit">Search</button>
            </form>
            <div class="status" id="rounds-status-msg"></div>
            <div class="table-wrapper">
              <table>
                <thead><tr><th>ID</th><th>Status</th><th>Start</th><th>Lock</th><th>End</th><th>Locked Price</th><th>Final Price</th><th>Result</th></tr></thead>
                <tbody id="rounds-table-body"></tbody>
              </table>
            </div>
            <div class="pagination" id="rounds-pagination"></div>
          </section>
        </div>

        <!-- Bets Tab -->
        <div class="tab-content" id="tab-bets">
          <section class="section">
            <h2>Bet Records</h2>
            <form id="bets-form" class="filters">
              <label>Bet ID<input id="bets-id" type="text" /></label>
              <label>Round ID<input id="bets-round" type="number" /></label>
              <label>Merchant<input id="bets-merchant" type="text" /></label>
              <label>Player<input id="bets-player" type="text" /></label>
              <label>Result
                <select id="bets-result">
                  <option value="">All</option>
                  <option value="WIN">Win</option>
                  <option value="LOSE">Lose</option>
                  <option value="PENDING">Pending</option>
                  <option value="REFUND">Refund</option>
                </select>
              </label>
              <label>Start<input id="bets-start" type="date" /></label>
              <label>End<input id="bets-end" type="date" /></label>
              <button class="primary" type="submit">Search</button>
            </form>
            <div class="status" id="bets-status"></div>
            <div class="table-wrapper">
              <table>
                <thead><tr><th>ID</th><th>Round</th><th>Player</th><th>Type</th><th>Selection</th><th>Amount</th><th>Odds</th><th>Payout</th><th>Result</th><th>Time</th></tr></thead>
                <tbody id="bets-table-body"></tbody>
              </table>
            </div>
            <div class="pagination" id="bets-pagination"></div>
          </section>
        </div>

        <!-- Players Tab -->
        <div class="tab-content" id="tab-players">
          <section class="section">
            <h2>Player Management</h2>
            <form id="players-form" class="filters">
              <label>Merchant<input id="players-merchant" type="text" /></label>
              <label>Account<input id="players-account" type="text" /></label>
              <label>Status
                <select id="players-status">
                  <option value="">All</option>
                  <option value="ENABLED">Enabled</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </label>
              <button class="primary" type="submit">Search</button>
            </form>
            <div class="status" id="players-status-msg"></div>
            <div class="table-wrapper">
              <table>
                <thead><tr><th>ID</th><th>Merchant</th><th>Account</th><th>Balance</th><th>Currency</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody id="players-table-body"></tbody>
              </table>
            </div>
            <div class="pagination" id="players-pagination"></div>
          </section>
        </div>

        <!-- Merchants Tab -->
        <div class="tab-content" id="tab-merchants">
          <section class="section">
            <h2>Merchant Management</h2>
            <form id="merchants-form" class="filters">
              <label>Merchant ID<input id="merchants-id" type="text" /></label>
              <label>Name<input id="merchants-name" type="text" /></label>
              <label>Active
                <select id="merchants-active">
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
              <button class="primary" type="submit">Search</button>
              <button type="button" id="merchants-new" class="secondary">+ New</button>
            </form>
            <div class="status" id="merchants-status"></div>
            <div class="table-wrapper">
              <table>
                <thead><tr><th>ID</th><th>Merchant ID</th><th>Name</th><th>Hash Key</th><th>Active</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody id="merchants-table-body"></tbody>
              </table>
            </div>
            <div class="pagination" id="merchants-pagination"></div>
          </section>
        </div>

        <!-- Transfers Tab -->
        <div class="tab-content" id="tab-transfers">
          <section class="section">
            <h2>Transfer Records</h2>
            <form id="transfers-form" class="filters">
              <label>Merchant<input id="transfers-merchant" type="text" /></label>
              <label>Account<input id="transfers-account" type="text" /></label>
              <label>Type
                <select id="transfers-type">
                  <option value="">All</option>
                  <option value="1">In</option>
                  <option value="2">Out</option>
                </select>
              </label>
              <label>Start<input id="transfers-start" type="date" /></label>
              <label>End<input id="transfers-end" type="date" /></label>
              <button class="primary" type="submit">Search</button>
            </form>
            <div class="status" id="transfers-status"></div>
            <div class="table-wrapper">
              <table>
                <thead><tr><th>ID</th><th>Merchant</th><th>Player</th><th>Order No</th><th>Type</th><th>Amount</th><th>Balance After</th><th>Time</th></tr></thead>
                <tbody id="transfers-table-body"></tbody>
              </table>
            </div>
            <div class="pagination" id="transfers-pagination"></div>
          </section>
        </div>

        <!-- Transactions Tab -->
        <div class="tab-content" id="tab-transactions">
          <section class="section">
            <h2>Wallet Transactions</h2>
            <form id="transactions-form" class="filters">
              <label>Merchant<input id="transactions-merchant" type="text" /></label>
              <label>Account<input id="transactions-account" type="text" /></label>
              <label>Type
                <select id="transactions-type">
                  <option value="">All</option>
                  <option value="TRANSFER_IN">Transfer In</option>
                  <option value="TRANSFER_OUT">Transfer Out</option>
                  <option value="BET">Bet</option>
                  <option value="PAYOUT">Payout</option>
                  <option value="CANCEL">Cancel</option>
                  <option value="BONUS">Bonus</option>
                </select>
              </label>
              <label>Start<input id="transactions-start" type="date" /></label>
              <label>End<input id="transactions-end" type="date" /></label>
              <button class="primary" type="submit">Search</button>
            </form>
            <div class="status" id="transactions-status"></div>
            <div class="table-wrapper">
              <table>
                <thead><tr><th>ID</th><th>Player</th><th>Type</th><th>Reference</th><th>Before</th><th>Amount</th><th>After</th><th>Time</th></tr></thead>
                <tbody id="transactions-table-body"></tbody>
              </table>
            </div>
            <div class="pagination" id="transactions-pagination"></div>
          </section>
        </div>
      </div>
    </div>

    <script>
      const tokenKey = 'adminToken';
      let token = localStorage.getItem(tokenKey) || '';

      // DOM elements
      const $ = (sel) => document.querySelector(sel);
      const $$ = (sel) => document.querySelectorAll(sel);

      const loginSection = $('#login-section');
      const mainContent = $('#main-content');
      const logoutBtn = $('#logout-btn');
      const loginForm = $('#login-form');
      const loginStatus = $('#login-status');

      // State for pagination
      const pageState = {
        rounds: { page: 0, limit: 20 },
        bets: { page: 0, limit: 20 },
        players: { page: 0, limit: 20 },
        merchants: { page: 0, limit: 20 },
        transfers: { page: 0, limit: 20 },
        transactions: { page: 0, limit: 20 },
      };

      // Utilities
      const setStatus = (el, message, isError) => {
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('error', isError);
      };

      const formatDate = (iso) => iso ? new Date(iso).toLocaleString() : '--';
      const formatNum = (v) => Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '--';

      const setAuthState = (authed) => {
        loginSection.classList.toggle('hidden', authed);
        mainContent.classList.toggle('hidden', !authed);
        logoutBtn.classList.toggle('hidden', !authed);
      };

      const handleAuthFailure = (msg) => {
        token = '';
        localStorage.removeItem(tokenKey);
        setAuthState(false);
        setStatus(loginStatus, msg || 'Session expired.', true);
      };

      const apiFetch = async (path, opts = {}) => {
        const headers = { 'Content-Type': 'application/json', ...opts.headers };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const res = await fetch(path, { ...opts, headers });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 401 || res.status === 403) handleAuthFailure(err.message);
          throw new Error(err.message || 'Request failed');
        }
        return res.json();
      };

      // Tab handling
      const tabs = $('#tabs');
      tabs?.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-btn')) return;
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        $$('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        $('#tab-' + e.target.dataset.tab)?.classList.add('active');
      });

      // Login
      loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        setStatus(loginStatus, 'Logging in...');
        try {
          const data = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account: $('#login-account').value.trim(),
              password: $('#login-password').value.trim(),
            }),
          }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)));
          if (!data.accessToken) throw new Error('Missing token');
          token = data.accessToken;
          localStorage.setItem(tokenKey, token);
          setAuthState(true);
          loadConfig();
          initDateDefaults();
        } catch (err) {
          setStatus(loginStatus, err.message || 'Login failed', true);
        }
      });

      logoutBtn?.addEventListener('click', () => {
        token = '';
        localStorage.removeItem(tokenKey);
        setAuthState(false);
      });

      // Config
      const configForm = $('#config-form');
      const configStatus = $('#config-status');
      const loadConfig = async () => {
        setStatus(configStatus, 'Loading...');
        try {
          const cfg = await apiFetch('/config/game');
          $('#cfg-betting-duration').value = cfg.bettingDurationMs;
          $('#cfg-result-duration').value = cfg.resultDurationMs;
          $('#cfg-result-display-duration').value = cfg.resultDisplayDurationMs;
          $('#cfg-snapshot-interval').value = cfg.priceSnapshotInterval;
          $('#cfg-bonus-slot-total').value = cfg.bonusSlotChanceTotal;
          $('#cfg-min-bet').value = cfg.minBetAmount;
          $('#cfg-max-bet').value = cfg.maxBetAmount;
          $('#cfg-payout-up').value = cfg.payoutMultiplierUp;
          $('#cfg-payout-down').value = cfg.payoutMultiplierDown;
          setStatus(configStatus, 'Loaded.');
        } catch (err) {
          setStatus(configStatus, err.message, true);
        }
      };
      $('#config-reload')?.addEventListener('click', loadConfig);
      configForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        setStatus(configStatus, 'Saving...');
        try {
          await apiFetch('/config/game', {
            method: 'PUT',
            body: JSON.stringify({
              bettingDurationMs: Number($('#cfg-betting-duration').value),
              resultDurationMs: Number($('#cfg-result-duration').value),
              resultDisplayDurationMs: Number($('#cfg-result-display-duration').value),
              priceSnapshotInterval: Number($('#cfg-snapshot-interval').value),
              bonusSlotChanceTotal: Number($('#cfg-bonus-slot-total').value),
              minBetAmount: Number($('#cfg-min-bet').value),
              maxBetAmount: Number($('#cfg-max-bet').value),
              payoutMultiplierUp: Number($('#cfg-payout-up').value),
              payoutMultiplierDown: Number($('#cfg-payout-down').value),
            }),
          });
          setStatus(configStatus, 'Saved.');
        } catch (err) {
          setStatus(configStatus, err.message, true);
        }
      });

      // RTP
      const rtpForm = $('#rtp-form');
      const rtpStatus = $('#rtp-status');
      const rtpBody = $('#rtp-table-body');
      const loadRtp = async () => {
        setStatus(rtpStatus, 'Loading...');
        try {
          const params = new URLSearchParams();
          const start = $('#rtp-start').value;
          const end = $('#rtp-end').value;
          if (start) params.set('start', start);
          if (end) params.set('end', end);
          const rows = await apiFetch('/admin/stats/daily-rtp?' + params);
          rtpBody.innerHTML = rows.length ? rows.map(r => \`<tr>
            <td>\${r.day}</td><td>\${r.bets}</td><td>\${formatNum(r.totalStake)}</td>
            <td>\${formatNum(r.totalPayout)}</td><td>\${formatNum(r.net)}</td>
            <td>\${(r.rtp * 100).toFixed(2)}%</td>
          </tr>\`).join('') : '<tr><td colspan="6">No data</td></tr>';
          setStatus(rtpStatus, 'Loaded.');
        } catch (err) {
          setStatus(rtpStatus, err.message, true);
        }
      };
      rtpForm?.addEventListener('submit', (e) => { e.preventDefault(); loadRtp(); });

      // Rounds
      const roundsForm = $('#rounds-form');
      const roundsBody = $('#rounds-table-body');
      const roundsStatusEl = $('#rounds-status-msg');
      const loadRounds = async (page = 0) => {
        pageState.rounds.page = page;
        setStatus(roundsStatusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageState.rounds.limit });
          const id = $('#rounds-id').value;
          const status = $('#rounds-status').value;
          const start = $('#rounds-start').value;
          const end = $('#rounds-end').value;
          if (id) params.set('roundId', id);
          if (status) params.set('status', status);
          if (start) params.set('start', start);
          if (end) params.set('end', end);
          const data = await apiFetch('/admin/rounds?' + params);
          roundsBody.innerHTML = data.items.length ? data.items.map(r => \`<tr>
            <td>\${r.id}</td>
            <td><span class="badge \${r.status === 'COMPLETED' ? 'success' : 'info'}">\${r.status}</span></td>
            <td>\${formatDate(r.startTime)}</td><td>\${formatDate(r.lockTime)}</td><td>\${formatDate(r.endTime)}</td>
            <td>\${formatNum(r.lockedPrice)}</td><td>\${formatNum(r.finalPrice)}</td>
            <td>\${r.winningSide || '--'} \${r.digitResult ? '(' + r.digitResult + ')' : ''}</td>
          </tr>\`).join('') : '<tr><td colspan="8">No data</td></tr>';
          renderPagination('rounds', data, loadRounds);
          setStatus(roundsStatusEl, '');
        } catch (err) {
          setStatus(roundsStatusEl, err.message, true);
        }
      };
      roundsForm?.addEventListener('submit', (e) => { e.preventDefault(); loadRounds(0); });

      // Bets
      const betsForm = $('#bets-form');
      const betsBody = $('#bets-table-body');
      const betsStatusEl = $('#bets-status');
      const loadBets = async (page = 0) => {
        pageState.bets.page = page;
        setStatus(betsStatusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageState.bets.limit });
          const betId = $('#bets-id').value;
          const roundId = $('#bets-round').value;
          const merchant = $('#bets-merchant').value;
          const player = $('#bets-player').value;
          const result = $('#bets-result').value;
          const start = $('#bets-start').value;
          const end = $('#bets-end').value;
          if (betId) params.set('betId', betId);
          if (roundId) params.set('roundId', roundId);
          if (merchant) params.set('merchantId', merchant);
          if (player) params.set('playerId', player);
          if (result) params.set('result', result);
          if (start) params.set('start', start);
          if (end) params.set('end', end);
          const data = await apiFetch('/admin/bets?' + params);
          betsBody.innerHTML = data.items.length ? data.items.map(b => \`<tr>
            <td title="\${b.id}">\${b.id.slice(0,8)}...</td>
            <td>\${b.roundId}</td><td>\${b.playerAccount || b.playerId}</td>
            <td>\${b.betType}</td><td>\${b.digitType || b.side || '--'} \${b.selection || ''}</td>
            <td>\${formatNum(b.amount)}</td><td>\${b.odds}</td><td>\${formatNum(b.payout)}</td>
            <td><span class="badge \${b.result === 'WIN' ? 'success' : b.result === 'LOSE' ? 'error' : 'info'}">\${b.result}</span></td>
            <td>\${formatDate(b.createdAt)}</td>
          </tr>\`).join('') : '<tr><td colspan="10">No data</td></tr>';
          renderPagination('bets', data, loadBets);
          setStatus(betsStatusEl, '');
        } catch (err) {
          setStatus(betsStatusEl, err.message, true);
        }
      };
      betsForm?.addEventListener('submit', (e) => { e.preventDefault(); loadBets(0); });

      // Players
      const playersForm = $('#players-form');
      const playersBody = $('#players-table-body');
      const playersStatusEl = $('#players-status-msg');
      const loadPlayers = async (page = 0) => {
        pageState.players.page = page;
        setStatus(playersStatusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageState.players.limit });
          const merchant = $('#players-merchant').value;
          const account = $('#players-account').value;
          const status = $('#players-status').value;
          if (merchant) params.set('merchantId', merchant);
          if (account) params.set('account', account);
          if (status) params.set('status', status);
          const data = await apiFetch('/admin/players?' + params);
          playersBody.innerHTML = data.items.length ? data.items.map(p => \`<tr>
            <td title="\${p.id}">\${p.id.slice(0,8)}...</td>
            <td>\${p.merchantId || '--'}</td><td>\${p.merchantAccount || p.account}</td>
            <td>\${formatNum(p.balance)}</td><td>\${p.currency}</td>
            <td><span class="badge \${p.status === 'ENABLED' ? 'success' : 'error'}">\${p.status}</span></td>
            <td>\${formatDate(p.createdAt)}</td>
            <td>
              <button class="small secondary" onclick="togglePlayerStatus('\${p.id}', '\${p.status}')">\${p.status === 'ENABLED' ? 'Disable' : 'Enable'}</button>
            </td>
          </tr>\`).join('') : '<tr><td colspan="8">No data</td></tr>';
          renderPagination('players', data, loadPlayers);
          setStatus(playersStatusEl, '');
        } catch (err) {
          setStatus(playersStatusEl, err.message, true);
        }
      };
      playersForm?.addEventListener('submit', (e) => { e.preventDefault(); loadPlayers(0); });

      window.togglePlayerStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'ENABLED' ? 'DISABLED' : 'ENABLED';
        if (!confirm(\`Change player status to \${newStatus}?\`)) return;
        try {
          await apiFetch('/admin/players/' + id + '/status', {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus }),
          });
          loadPlayers(pageState.players.page);
        } catch (err) {
          alert(err.message);
        }
      };

      // Merchants
      const merchantsForm = $('#merchants-form');
      const merchantsBody = $('#merchants-table-body');
      const merchantsStatusEl = $('#merchants-status');
      const loadMerchants = async (page = 0) => {
        pageState.merchants.page = page;
        setStatus(merchantsStatusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageState.merchants.limit });
          const id = $('#merchants-id').value;
          const name = $('#merchants-name').value;
          const active = $('#merchants-active').value;
          if (id) params.set('merchantId', id);
          if (name) params.set('name', name);
          if (active) params.set('isActive', active);
          const data = await apiFetch('/admin/merchants?' + params);
          merchantsBody.innerHTML = data.items.length ? data.items.map(m => \`<tr>
            <td title="\${m.id}">\${m.id.slice(0,8)}...</td>
            <td>\${m.merchantId}</td><td>\${m.name}</td><td>\${m.hashKeyMasked}</td>
            <td><span class="badge \${m.isActive ? 'success' : 'error'}">\${m.isActive ? 'Active' : 'Inactive'}</span></td>
            <td>\${formatDate(m.createdAt)}</td>
            <td><button class="small secondary" onclick="editMerchant('\${m.id}')">Edit</button></td>
          </tr>\`).join('') : '<tr><td colspan="7">No data</td></tr>';
          renderPagination('merchants', data, loadMerchants);
          setStatus(merchantsStatusEl, '');
        } catch (err) {
          setStatus(merchantsStatusEl, err.message, true);
        }
      };
      merchantsForm?.addEventListener('submit', (e) => { e.preventDefault(); loadMerchants(0); });

      $('#merchants-new')?.addEventListener('click', () => {
        const merchantId = prompt('Merchant ID:');
        if (!merchantId) return;
        const name = prompt('Name:');
        if (!name) return;
        const hashKey = prompt('Hash Key (min 8 chars):');
        if (!hashKey || hashKey.length < 8) return alert('Hash key must be at least 8 characters');
        apiFetch('/admin/merchants', {
          method: 'POST',
          body: JSON.stringify({ merchantId, name, hashKey }),
        }).then(() => loadMerchants(0)).catch(err => alert(err.message));
      });

      window.editMerchant = async (id) => {
        const name = prompt('New name (leave empty to skip):');
        const hashKey = prompt('New hash key (leave empty to skip):');
        const activeStr = prompt('Active? (true/false, leave empty to skip):');
        const updates = {};
        if (name) updates.name = name;
        if (hashKey) updates.hashKey = hashKey;
        if (activeStr === 'true') updates.isActive = true;
        if (activeStr === 'false') updates.isActive = false;
        if (!Object.keys(updates).length) return;
        try {
          await apiFetch('/admin/merchants/' + id, { method: 'PUT', body: JSON.stringify(updates) });
          loadMerchants(pageState.merchants.page);
        } catch (err) {
          alert(err.message);
        }
      };

      // Transfers
      const transfersForm = $('#transfers-form');
      const transfersBody = $('#transfers-table-body');
      const transfersStatusEl = $('#transfers-status');
      const loadTransfers = async (page = 0) => {
        pageState.transfers.page = page;
        setStatus(transfersStatusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageState.transfers.limit });
          const merchant = $('#transfers-merchant').value;
          const account = $('#transfers-account').value;
          const type = $('#transfers-type').value;
          const start = $('#transfers-start').value;
          const end = $('#transfers-end').value;
          if (merchant) params.set('merchantId', merchant);
          if (account) params.set('account', account);
          if (type) params.set('type', type);
          if (start) params.set('start', start);
          if (end) params.set('end', end);
          const data = await apiFetch('/admin/transfers?' + params);
          transfersBody.innerHTML = data.items.length ? data.items.map(t => \`<tr>
            <td title="\${t.visibleId}">\${t.visibleId.slice(0,8)}...</td>
            <td>\${t.merchantId}</td><td>\${t.playerAccount || t.playerId}</td>
            <td>\${t.orderNo}</td>
            <td><span class="badge \${t.type === 1 ? 'success' : 'warning'}">\${t.type === 1 ? 'IN' : 'OUT'}</span></td>
            <td>\${formatNum(t.amount)}</td><td>\${formatNum(t.balanceAfter)}</td>
            <td>\${formatDate(t.createdAt)}</td>
          </tr>\`).join('') : '<tr><td colspan="8">No data</td></tr>';
          renderPagination('transfers', data, loadTransfers);
          setStatus(transfersStatusEl, '');
        } catch (err) {
          setStatus(transfersStatusEl, err.message, true);
        }
      };
      transfersForm?.addEventListener('submit', (e) => { e.preventDefault(); loadTransfers(0); });

      // Transactions
      const transactionsForm = $('#transactions-form');
      const transactionsBody = $('#transactions-table-body');
      const transactionsStatusEl = $('#transactions-status');
      const loadTransactions = async (page = 0) => {
        pageState.transactions.page = page;
        setStatus(transactionsStatusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageState.transactions.limit });
          const merchant = $('#transactions-merchant').value;
          const account = $('#transactions-account').value;
          const type = $('#transactions-type').value;
          const start = $('#transactions-start').value;
          const end = $('#transactions-end').value;
          if (merchant) params.set('merchantId', merchant);
          if (account) params.set('account', account);
          if (type) params.set('type', type);
          if (start) params.set('start', start);
          if (end) params.set('end', end);
          const data = await apiFetch('/admin/transactions?' + params);
          transactionsBody.innerHTML = data.items.length ? data.items.map(t => \`<tr>
            <td title="\${t.id}">\${t.id.slice(0,8)}...</td>
            <td>\${t.playerAccount || t.playerId}</td>
            <td><span class="badge info">\${t.type}</span></td>
            <td>\${t.referenceId || '--'}</td>
            <td>\${formatNum(t.balanceBefore)}</td>
            <td style="color: \${t.amount >= 0 ? '#4ade80' : '#f87171'}">\${t.amount >= 0 ? '+' : ''}\${formatNum(t.amount)}</td>
            <td>\${formatNum(t.balanceAfter)}</td>
            <td>\${formatDate(t.createdAt)}</td>
          </tr>\`).join('') : '<tr><td colspan="8">No data</td></tr>';
          renderPagination('transactions', data, loadTransactions);
          setStatus(transactionsStatusEl, '');
        } catch (err) {
          setStatus(transactionsStatusEl, err.message, true);
        }
      };
      transactionsForm?.addEventListener('submit', (e) => { e.preventDefault(); loadTransactions(0); });

      // Pagination helper
      const renderPagination = (key, data, loadFn) => {
        const el = $('#' + key + '-pagination');
        if (!el) return;
        const { page, hasNext } = data;
        el.innerHTML = \`
          <button \${page === 0 ? 'disabled' : ''} onclick="window._loadPage('\${key}', \${page - 1})">Prev</button>
          <span>Page \${page + 1}</span>
          <button \${!hasNext ? 'disabled' : ''} onclick="window._loadPage('\${key}', \${page + 1})">Next</button>
        \`;
        window._loadPage = (k, p) => {
          const fns = { rounds: loadRounds, bets: loadBets, players: loadPlayers, merchants: loadMerchants, transfers: loadTransfers, transactions: loadTransactions };
          fns[k]?.(p);
        };
      };

      // Init
      const initDateDefaults = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 6);
        const endStr = end.toISOString().slice(0, 10);
        const startStr = start.toISOString().slice(0, 10);
        ['#rtp-start', '#rounds-start', '#bets-start', '#transfers-start', '#transactions-start'].forEach(s => {
          const el = $(s);
          if (el) el.value = startStr;
        });
        ['#rtp-end', '#rounds-end', '#bets-end', '#transfers-end', '#transactions-end'].forEach(s => {
          const el = $(s);
          if (el) el.value = endStr;
        });
      };

      setAuthState(Boolean(token));
      if (token) {
        loadConfig();
        initDateDefaults();
      }
    </script>
  </body>
</html>`;
