import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminStatsService } from './admin-stats.service';

const ADMIN_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Tools</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f6f8;
        --panel: #ffffff;
        --text: #1b1f24;
        --muted: #6b7280;
        --accent: #0ea5e9;
        --border: #e5e7eb;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      .page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 2rem 1.25rem 3rem;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
      }
      h1 {
        font-size: 1.6rem;
        margin: 0;
      }
      .tagline {
        color: var(--muted);
        font-size: 0.95rem;
        margin-top: 0.25rem;
      }
      .toolbar {
        display: flex;
        gap: 0.75rem;
      }
      button {
        cursor: pointer;
        border: 1px solid var(--border);
        background: #fff;
        color: var(--text);
        padding: 0.6rem 0.9rem;
        border-radius: 10px;
        font-weight: 600;
      }
      button.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
      button.secondary {
        background: #fff;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .section {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 1.25rem;
        margin-bottom: 1.25rem;
      }
      .section h2 {
        margin: 0 0 0.9rem 0;
        font-size: 1.15rem;
      }
      .hidden {
        display: none;
      }
      .status {
        margin-top: 0.6rem;
        font-size: 0.9rem;
        color: var(--muted);
      }
      .status.error {
        color: #b91c1c;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.9rem 1.1rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.9rem;
        color: var(--muted);
      }
      input {
        padding: 0.45rem 0.6rem;
        border-radius: 8px;
        border: 1px solid var(--border);
        font-size: 0.95rem;
      }
      .form-actions {
        display: flex;
        gap: 0.6rem;
        margin-top: 1rem;
      }
      .sum-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 0.6rem;
      }
      .sum-field {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0.5rem;
        background: #f9fafb;
      }
      .sum-field span {
        font-size: 0.8rem;
        color: var(--muted);
      }
      .sum-field input {
        margin-top: 0.35rem;
        width: 100%;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border-bottom: 1px solid var(--border);
        text-align: left;
        padding: 0.6rem 0.4rem;
        font-size: 0.9rem;
      }
      th {
        color: var(--muted);
        font-weight: 600;
      }
      .rtp-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: flex-end;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <div>
          <h1>Admin Tools</h1>
          <div class="tagline">Server-side tuning and daily RTP.</div>
        </div>
        <div class="toolbar">
          <button id="logout-btn" class="secondary hidden" type="button">Logout</button>
        </div>
      </header>

      <section class="section" id="login-section">
        <h2>Admin Login</h2>
        <form id="login-form">
          <div class="grid">
            <label>
              Account
              <input id="login-account" type="text" autocomplete="username" required />
            </label>
            <label>
              Password
              <input id="login-password" type="password" autocomplete="current-password" required />
            </label>
          </div>
          <div class="form-actions">
            <button class="primary" type="submit">Login</button>
          </div>
          <div class="status" id="login-status"></div>
        </form>
      </section>

      <section class="section hidden" id="config-section">
        <h2>Game Configuration</h2>
        <form id="config-form">
          <div class="grid">
            <label>
              Betting duration (ms)
              <input id="cfg-betting-duration" type="number" min="0" step="100" />
            </label>
            <label>
              Result duration (ms)
              <input id="cfg-result-duration" type="number" min="0" step="100" />
            </label>
            <label>
              Result display duration (ms)
              <input id="cfg-result-display-duration" type="number" min="0" step="100" />
            </label>
            <label>
              Price snapshot interval (ms)
              <input id="cfg-snapshot-interval" type="number" min="1" step="100" />
            </label>
            <label>
              Min bet amount
              <input id="cfg-min-bet" type="number" min="0" step="0.01" />
            </label>
            <label>
              Max bet amount
              <input id="cfg-max-bet" type="number" min="0" step="0.01" />
            </label>
            <label>
              Hi-Lo payout up
              <input id="cfg-payout-up" type="number" min="0" step="0.01" />
            </label>
            <label>
              Hi-Lo payout down
              <input id="cfg-payout-down" type="number" min="0" step="0.01" />
            </label>
            <label>
              Small/Big/Odd/Even payout
              <input id="cfg-digit-sboe" type="number" min="0" step="0.01" />
            </label>
            <label>
              Any triple payout
              <input id="cfg-digit-any-triple" type="number" min="0" step="0.01" />
            </label>
            <label>
              Double payout
              <input id="cfg-digit-double" type="number" min="0" step="0.01" />
            </label>
            <label>
              Triple payout
              <input id="cfg-digit-triple" type="number" min="0" step="0.01" />
            </label>
            <label>
              Single payout (1x)
              <input id="cfg-digit-single" type="number" min="0" step="0.01" />
            </label>
            <label>
              Single payout (2x)
              <input id="cfg-digit-single-double" type="number" min="0" step="0.01" />
            </label>
            <label>
              Single payout (3x)
              <input id="cfg-digit-single-triple" type="number" min="0" step="0.01" />
            </label>
          </div>
          <div style="margin-top: 1rem;">
            <h3 style="margin: 0 0 0.5rem 0;">Digit Sum Payouts</h3>
            <div class="sum-grid" id="sum-grid"></div>
          </div>
          <div class="form-actions">
            <button type="button" id="config-reload">Reload</button>
            <button class="primary" type="submit">Save (applies next round)</button>
          </div>
          <div class="status" id="config-status"></div>
        </form>
      </section>

      <section class="section hidden" id="rtp-section">
        <h2>Daily RTP</h2>
        <form id="rtp-form" class="rtp-controls">
          <label>
            Start date
            <input id="rtp-start" type="date" />
          </label>
          <label>
            End date
            <input id="rtp-end" type="date" />
          </label>
          <button class="primary" type="submit">Load</button>
        </form>
        <div class="status" id="rtp-status"></div>
        <div style="margin-top: 0.75rem;">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Bets</th>
                <th>Stake</th>
                <th>Payout</th>
                <th>Net</th>
                <th>RTP</th>
              </tr>
            </thead>
            <tbody id="rtp-table-body"></tbody>
          </table>
        </div>
      </section>
    </div>

    <script>
      const tokenKey = 'adminToken';
      let token = localStorage.getItem(tokenKey) || '';
      const loginSection = document.querySelector('#login-section');
      const loginForm = document.querySelector('#login-form');
      const loginStatus = document.querySelector('#login-status');
      const logoutBtn = document.querySelector('#logout-btn');
      const configSection = document.querySelector('#config-section');
      const configForm = document.querySelector('#config-form');
      const configStatus = document.querySelector('#config-status');
      const configReload = document.querySelector('#config-reload');
      const rtpSection = document.querySelector('#rtp-section');
      const rtpForm = document.querySelector('#rtp-form');
      const rtpStatus = document.querySelector('#rtp-status');
      const rtpBody = document.querySelector('#rtp-table-body');
      const sumGrid = document.querySelector('#sum-grid');

      const sumKeys = Array.from({ length: 20 }, (_, idx) => idx + 4);
      const sumInputs = new Map();

      const setStatus = (el, message, isError) => {
        if (!el) return;
        el.textContent = message || '';
        if (isError) {
          el.classList.add('error');
        } else {
          el.classList.remove('error');
        }
      };

      const setAuthState = (authed) => {
        if (loginSection) loginSection.classList.toggle('hidden', authed);
        if (configSection) configSection.classList.toggle('hidden', !authed);
        if (rtpSection) rtpSection.classList.toggle('hidden', !authed);
        if (logoutBtn) logoutBtn.classList.toggle('hidden', !authed);
      };

      const apiFetch = async (path, options) => {
        const next = options || {};
        const headers = Object.assign({}, next.headers || {});
        headers['Content-Type'] = 'application/json';
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const response = await fetch(path, Object.assign({}, next, { headers }));
        if (!response.ok) {
          const detail = await response.json().catch(() => ({}));
          const message = detail && detail.message ? detail.message : response.statusText;
          throw new Error(message);
        }
        return response.json();
      };

      const readNumber = (id, label) => {
        const el = document.querySelector(id);
        if (!el) throw new Error(label + ' input missing');
        const raw = String(el.value || '').trim();
        if (!raw) throw new Error(label + ' is required');
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new Error(label + ' must be a number');
        return value;
      };

      const setValue = (id, value) => {
        const el = document.querySelector(id);
        if (!el) return;
        if (value === null || value === undefined || Number.isNaN(Number(value))) {
          el.value = '';
        } else {
          el.value = String(value);
        }
      };

      const buildSumInputs = () => {
        if (!sumGrid) return;
        sumGrid.innerHTML = '';
        sumInputs.clear();
        sumKeys.forEach((key) => {
          const label = document.createElement('label');
          label.className = 'sum-field';
          const span = document.createElement('span');
          span.textContent = 'Sum ' + String(key);
          const input = document.createElement('input');
          input.type = 'number';
          input.min = '0';
          input.step = '0.01';
          input.dataset.sumKey = String(key);
          label.appendChild(span);
          label.appendChild(input);
          sumGrid.appendChild(label);
          sumInputs.set(key, input);
        });
      };

      const setConfigForm = (config) => {
        setValue('#cfg-betting-duration', config.bettingDurationMs);
        setValue('#cfg-result-duration', config.resultDurationMs);
        setValue('#cfg-result-display-duration', config.resultDisplayDurationMs);
        setValue('#cfg-snapshot-interval', config.priceSnapshotInterval);
        setValue('#cfg-min-bet', config.minBetAmount);
        setValue('#cfg-max-bet', config.maxBetAmount);
        setValue('#cfg-payout-up', config.payoutMultiplierUp);
        setValue('#cfg-payout-down', config.payoutMultiplierDown);
        setValue('#cfg-digit-sboe', config.digitPayouts.smallBigOddEven);
        setValue('#cfg-digit-any-triple', config.digitPayouts.anyTriple);
        setValue('#cfg-digit-double', config.digitPayouts.double);
        setValue('#cfg-digit-triple', config.digitPayouts.triple);
        setValue('#cfg-digit-single', config.digitPayouts.single.single);
        setValue('#cfg-digit-single-double', config.digitPayouts.single.double);
        setValue('#cfg-digit-single-triple', config.digitPayouts.single.triple);
        sumKeys.forEach((key) => {
          const input = sumInputs.get(key);
          if (!input) return;
          const value = config.digitPayouts.sum[key];
          input.value = value !== undefined ? String(value) : '';
        });
      };

      const loadConfig = async () => {
        setStatus(configStatus, 'Loading...');
        const config = await apiFetch('/config/game');
        setConfigForm(config);
        setStatus(configStatus, 'Loaded.');
      };

      const buildConfigPayload = () => {
        const sum = {};
        sumKeys.forEach((key) => {
          const input = sumInputs.get(key);
          if (!input) return;
          const value = Number(input.value);
          if (!Number.isFinite(value)) {
            throw new Error('Sum ' + key + ' is required');
          }
          sum[key] = value;
        });

        return {
          bettingDurationMs: readNumber('#cfg-betting-duration', 'Betting duration'),
          resultDurationMs: readNumber('#cfg-result-duration', 'Result duration'),
          resultDisplayDurationMs: readNumber('#cfg-result-display-duration', 'Result display duration'),
          minBetAmount: readNumber('#cfg-min-bet', 'Min bet amount'),
          maxBetAmount: readNumber('#cfg-max-bet', 'Max bet amount'),
          payoutMultiplierUp: readNumber('#cfg-payout-up', 'Hi-Lo payout up'),
          payoutMultiplierDown: readNumber('#cfg-payout-down', 'Hi-Lo payout down'),
          priceSnapshotInterval: readNumber('#cfg-snapshot-interval', 'Price snapshot interval'),
          digitPayouts: {
            smallBigOddEven: readNumber('#cfg-digit-sboe', 'Small/Big/Odd/Even payout'),
            anyTriple: readNumber('#cfg-digit-any-triple', 'Any triple payout'),
            double: readNumber('#cfg-digit-double', 'Double payout'),
            triple: readNumber('#cfg-digit-triple', 'Triple payout'),
            single: {
              single: readNumber('#cfg-digit-single', 'Single payout (1x)'),
              double: readNumber('#cfg-digit-single-double', 'Single payout (2x)'),
              triple: readNumber('#cfg-digit-single-triple', 'Single payout (3x)'),
            },
            sum: sum,
          },
        };
      };

      const formatNumber = (value) => {
        if (!Number.isFinite(value)) return '--';
        return value.toFixed(2).replace(/\\.00$/, '');
      };

      const renderRtp = (rows) => {
        if (!rtpBody) return;
        if (!rows || !rows.length) {
          rtpBody.innerHTML = '<tr><td colspan="6">No data</td></tr>';
          return;
        }
        rtpBody.innerHTML = rows.map((row) => {
          const rtpPct = Number.isFinite(row.rtp) ? (row.rtp * 100).toFixed(2) + '%' : '--';
          return '<tr>' +
            '<td>' + row.day + '</td>' +
            '<td>' + row.bets + '</td>' +
            '<td>' + formatNumber(row.totalStake) + '</td>' +
            '<td>' + formatNumber(row.totalPayout) + '</td>' +
            '<td>' + formatNumber(row.net) + '</td>' +
            '<td>' + rtpPct + '</td>' +
            '</tr>';
        }).join('');
      };

      const loadRtp = async () => {
        setStatus(rtpStatus, 'Loading...');
        const start = document.querySelector('#rtp-start').value;
        const end = document.querySelector('#rtp-end').value;
        const params = new URLSearchParams();
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        const path = '/admin/stats/daily-rtp' + (params.toString() ? '?' + params.toString() : '');
        const rows = await apiFetch(path);
        renderRtp(rows);
        setStatus(rtpStatus, 'Loaded.');
      };

      const initDefaults = () => {
        buildSumInputs();
        const startEl = document.querySelector('#rtp-start');
        const endEl = document.querySelector('#rtp-end');
        if (startEl && endEl) {
          const end = new Date();
          const start = new Date();
          start.setDate(end.getDate() - 6);
          endEl.value = end.toISOString().slice(0, 10);
          startEl.value = start.toISOString().slice(0, 10);
        }
      };

      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus(loginStatus, 'Logging in...');
        const account = document.querySelector('#login-account').value.trim();
        const password = document.querySelector('#login-password').value.trim();
        try {
          const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account: account, password: password }),
          });
          if (!res.ok) {
            const detail = await res.json().catch(() => ({}));
            throw new Error(detail.message || 'Login failed');
          }
          const data = await res.json();
          token = data.accessToken;
          localStorage.setItem(tokenKey, token);
          setStatus(loginStatus, 'Login successful.');
          setAuthState(true);
          await loadConfig();
          await loadRtp();
        } catch (error) {
          setStatus(loginStatus, error.message || 'Login failed', true);
        }
      });

      configReload.addEventListener('click', async () => {
        try {
          await loadConfig();
        } catch (error) {
          setStatus(configStatus, error.message || 'Failed to load config', true);
        }
      });

      configForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          setStatus(configStatus, 'Saving...');
          const payload = buildConfigPayload();
          const res = await apiFetch('/config/game', {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          setConfigForm(res);
          setStatus(configStatus, 'Saved. Changes apply next round.');
        } catch (error) {
          setStatus(configStatus, error.message || 'Failed to save config', true);
        }
      });

      rtpForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          await loadRtp();
        } catch (error) {
          setStatus(rtpStatus, error.message || 'Failed to load RTP', true);
        }
      });

      logoutBtn.addEventListener('click', () => {
        token = '';
        localStorage.removeItem(tokenKey);
        setAuthState(false);
      });

      initDefaults();
      setAuthState(Boolean(token));
      if (token) {
        loadConfig().catch((error) => setStatus(configStatus, error.message || 'Failed to load config', true));
        loadRtp().catch((error) => setStatus(rtpStatus, error.message || 'Failed to load RTP', true));
      }
    </script>
  </body>
</html>`;

@Controller('admin')
export class AdminController {
  constructor(private readonly statsService: AdminStatsService) {}

  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  getAdminPage() {
    return ADMIN_PAGE_HTML;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('stats/daily-rtp')
  getDailyRtp(@Query('start') start?: string, @Query('end') end?: string) {
    return this.statsService.getDailyRtp(start, end);
  }
}
