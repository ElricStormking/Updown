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
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", Tahoma, Arial, sans-serif;
        background: radial-gradient(
            1100px circle at 12% -18%,
            rgba(56, 189, 248, 0.08) 0%,
            transparent 50%
          ),
          radial-gradient(
            900px circle at 90% -12%,
            rgba(15, 118, 110, 0.12) 0%,
            transparent 55%
          ),
          linear-gradient(180deg, var(--bg) 0%, var(--bg-strong) 100%);
        color: var(--text);
      }
      .page {
        max-width: 1180px;
        margin: 0 auto;
        padding: 2.5rem 1.5rem 3.5rem;
      }
      header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.8rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border);
      }
      h1 {
        font-family: "Fraunces", "Times New Roman", serif;
        font-size: 1.9rem;
        margin: 0;
        letter-spacing: 0.02em;
      }
      .tagline {
        color: var(--muted);
        font-size: 0.9rem;
        margin-top: 0.35rem;
      }
      .toolbar {
        display: flex;
        gap: 0.6rem;
        align-items: center;
      }
      button {
        cursor: pointer;
        border: 1px solid var(--border);
        background: var(--panel-strong);
        color: var(--text);
        padding: 0.55rem 1.1rem;
        border-radius: 999px;
        font-weight: 600;
        font-size: 0.92rem;
        transition:
          transform 0.12s ease,
          box-shadow 0.12s ease,
          border-color 0.12s ease,
          background 0.12s ease;
      }
      button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 10px 24px rgba(3, 6, 10, 0.6);
        border-color: rgba(56, 189, 248, 0.35);
      }
      button.primary {
        background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
        border-color: transparent;
        color: #04111f;
        box-shadow: 0 14px 30px rgba(14, 165, 233, 0.35);
      }
      button.secondary {
        background: transparent;
        color: var(--text);
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
      }
      .section {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 1.4rem 1.35rem;
        margin-bottom: 1.25rem;
        box-shadow: var(--shadow);
        backdrop-filter: blur(8px);
      }
      .section h2 {
        margin: 0 0 1rem 0;
        font-size: 1.2rem;
        font-family: "Fraunces", "Times New Roman", serif;
        letter-spacing: 0.01em;
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
        color: #f87171;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 0.9rem 1.1rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        font-size: 0.82rem;
        color: var(--muted);
        letter-spacing: 0.02em;
      }
      input {
        padding: 0.55rem 0.7rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border);
        font-size: 0.95rem;
        background: #0b1320;
        color: var(--text);
        transition:
          border-color 0.12s ease,
          box-shadow 0.12s ease,
          background 0.12s ease;
        font-variant-numeric: tabular-nums;
      }
      input:focus {
        outline: none;
        border-color: rgba(56, 189, 248, 0.7);
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.16);
        background: #0f1b2f;
      }
      .form-actions {
        display: flex;
        gap: 0.6rem;
        margin-top: 1rem;
        flex-wrap: wrap;
      }
      .sum-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.6rem;
      }
      .sum-field {
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 0.55rem;
        background: var(--panel-strong);
      }
      .sum-field span {
        font-size: 0.75rem;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .sum-field input {
        margin-top: 0.4rem;
        width: 100%;
      }
      .bonus-ratio-wrapper {
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        overflow: auto;
        background: var(--panel-strong);
      }
      .bonus-ratio-scrollbar-top {
        overflow-x: auto;
        overflow-y: hidden;
        height: 14px;
        margin-bottom: 0.55rem;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.7);
        scrollbar-color: var(--accent) rgba(15, 23, 42, 0.35);
      }
      .bonus-ratio-scrollbar-top::-webkit-scrollbar {
        height: 8px;
      }
      .bonus-ratio-scrollbar-top::-webkit-scrollbar-thumb {
        background: rgba(56, 189, 248, 0.55);
        border-radius: 999px;
      }
      .bonus-ratio-scrollbar-top::-webkit-scrollbar-track {
        background: rgba(15, 23, 42, 0.35);
        border-radius: 999px;
      }
      .bonus-ratio-scrollbar-inner {
        height: 1px;
      }
      .bonus-ratio-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 860px;
      }
      .bonus-ratio-table th,
      .bonus-ratio-table td {
        border-bottom: 1px solid var(--border);
        text-align: center;
        padding: 0.55rem 0.6rem;
        font-size: 0.82rem;
      }
      .bonus-ratio-table th {
        color: var(--muted);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.7rem;
      }
      .bonus-ratio-table th:first-child,
      .bonus-ratio-table td:first-child {
        text-align: left;
      }
      .bonus-ratio-table input {
        width: 78px;
      }
      .bonus-ratio-table .sum-payout-input {
        width: 96px;
      }
      .bonus-ratio-table .sum-payout-col {
        text-align: left;
      }
      .bonus-ratio-table .payout-col {
        text-align: left;
        min-width: 130px;
      }
      .bonus-ratio-table .metric-col {
        min-width: 110px;
        text-align: left;
      }
      .bonus-ratio-table .total-counts-col {
        min-width: 120px;
        text-align: left;
      }
      .bonus-ratio-table th.base-weight-col {
        color: #f8fafc;
        background: linear-gradient(120deg, rgba(59, 130, 246, 0.2), rgba(2, 132, 199, 0.15));
        border-color: rgba(2, 132, 199, 0.55);
      }
      .bonus-ratio-table td.base-weight-cell {
        background: rgba(2, 132, 199, 0.12);
        border-left: 1px solid rgba(2, 132, 199, 0.45);
      }
      .bonus-ratio-table td.base-weight-cell input {
        background: rgba(2, 132, 199, 0.18);
        border-color: rgba(59, 130, 246, 0.4);
        color: #e0f2fe;
      }
      .bonus-ratio-table th.weights-group {
        color: #a5f3fc;
        background: linear-gradient(120deg, rgba(14, 116, 144, 0.2), rgba(15, 118, 110, 0.05));
        border-color: rgba(15, 118, 110, 0.55);
      }
      .bonus-ratio-table td.weight-cell {
        background: rgba(15, 118, 110, 0.12);
        border-left: 1px solid rgba(15, 118, 110, 0.45);
      }
      .bonus-ratio-table td.weight-cell input {
        background: rgba(2, 132, 199, 0.1);
        border-color: rgba(56, 189, 248, 0.4);
        color: #e0f2fe;
      }
      .bonus-ratio-table .total-counts-cell {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .total-counts-value {
        font-weight: 600;
        color: #f8fafc;
      }
      .metric-cell {
        text-align: left;
      }
      .metric-value {
        font-weight: 600;
        color: #7dd3fc;
      }
      .metric-input input {
        width: 84px;
      }
      .total-counts-cell input {
        width: 104px;
      }
      .bonus-ratio-table .payout-cell {
        text-align: left;
        padding: 0.55rem 0.6rem;
      }
      .bonus-ratio-table .payout-cell input {
        width: 96px;
      }
      .table-controls-row th {
        text-transform: none;
        letter-spacing: normal;
        font-size: 0.78rem;
        padding: 0.35rem 0.6rem;
        text-align: right;
      }
      .chip-group {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
      .chip-title {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.45rem;
        border-radius: 999px;
        border: 1px solid rgba(56, 189, 248, 0.28);
        background: rgba(56, 189, 248, 0.08);
        font-size: 0.7rem;
        color: var(--text);
      }
      .chip input {
        width: 64px;
        padding: 0.3rem 0.4rem;
        font-size: 0.8rem;
      }
      .bonus-ratio-table tbody tr:hover {
        background: #0f1a2a;
      }
      .bonus-ratio-table .slot-label {
        font-weight: 600;
        color: var(--text);
        letter-spacing: 0.02em;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        border-bottom: 1px solid var(--border);
        text-align: left;
        padding: 0.65rem 0.45rem;
        font-size: 0.9rem;
      }
      th {
        color: var(--muted);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.72rem;
      }
      tbody tr:hover {
        background: #0e1826;
      }
      .rtp-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: flex-end;
      }
      .sum-bonus-layout {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
        align-items: flex-start;
      }
      .sum-bonus-layout .sum-grid {
        flex: 1 1 320px;
      }
      .sum-bonus-layout .bonus-ratio-wrapper {
        flex: 1 1 560px;
      }
      .sum-bonus-layout h4 {
        margin: 0 0 0.5rem 0;
        font-family: "Fraunces", "Times New Roman", serif;
      }
      .formula-note {
        margin: 0 0 0.75rem 0;
        color: var(--muted);
        font-size: 0.78rem;
        line-height: 1.4;
      }
      .formula-note code {
        background: rgba(15, 23, 42, 0.9);
        padding: 0.15rem 0.35rem;
        border-radius: 4px;
        font-size: 0.78rem;
        letter-spacing: 0.03em;
      }
      @media (max-width: 760px) {
        header {
          flex-direction: column;
          align-items: flex-start;
        }
        .toolbar {
          width: 100%;
          justify-content: flex-end;
        }
        button {
          width: 100%;
        }
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
              Bonus slot chance total
              <input id="cfg-bonus-slot-total" type="number" min="1" step="1" />
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
          </div>
          <div style="margin-top: 1rem;">
            <h3 style="margin: 0 0 0.5rem 0;">Digit Bonus Ratios (Other Slots)</h3>
            <p class="formula-note">
              Payout Ratio is calculated as <code>1 + (baseRatio * baseCount + sum(bonusRatio_i * bonusWeight_i)) / (baseCount + sum(bonusWeight_i))</code>,
              where <code>baseCount = max(totalRoll - sum(bonusWeight_i), 0)</code> and <code>totalRoll</code> references the slot's Total Counts input (or the global Bonus slot chance total when the per-slot value is empty).
            </p>
            <div class="bonus-ratio-scrollbar-top" id="bonus-ratio-scrollbar-top">
              <div class="bonus-ratio-scrollbar-inner"></div>
            </div>
            <div class="bonus-ratio-wrapper" id="bonus-ratio-scroll">
              <table class="bonus-ratio-table">
                <thead>
                  <tr class="table-controls-row">
                    <th colspan="18">
                      <div class="chip-group">
                        <span class="chip-title">Single multipliers</span>
                        <label class="chip">
                          <span>2x</span>
                          <input id="cfg-digit-single-double" type="number" min="0" step="0.01" />
                        </label>
                        <label class="chip">
                          <span>3x</span>
                          <input id="cfg-digit-single-triple" type="number" min="0" step="0.01" />
                        </label>
                      </div>
                    </th>
                  </tr>
                  <tr>
                    <th rowspan="2">Bet Slot</th>
                    <th rowspan="2" class="metric-col">Bonus %</th>
                    <th rowspan="2" class="metric-col">Suggest Win %</th>
                    <th rowspan="2" class="metric-col">RTP %</th>
                    <th rowspan="2" class="metric-col">RTP FP %</th>
                    <th rowspan="2" class="payout-col">Payout Ratio</th>
                    <th colspan="5">Bonus Ratios</th>
                    <th colspan="6" class="weights-group">Bonus Weights</th>
                    <th rowspan="2" class="total-counts-col">Total Counts</th>
                  </tr>
                  <tr>
                    <th>1</th>
                    <th>2</th>
                    <th>3</th>
                    <th>4</th>
                    <th>5</th>
                    <th class="base-weight-col">Base</th>
                    <th>1</th>
                    <th>2</th>
                    <th>3</th>
                    <th>4</th>
                    <th>5</th>
                  </tr>
                </thead>
                <tbody id="bonus-ratio-body"></tbody>
              </table>
            </div>
          </div>
          <div style="margin-top: 1.25rem;">
            <h3 style="margin: 0 0 0.5rem 0;">Digit Sum Payouts + Sum Bonus Ratios</h3>
            <div class="bonus-ratio-wrapper">
              <table class="bonus-ratio-table sum-bonus-table">
                <thead>
                  <tr>
                    <th rowspan="2">Bet Slot</th>
                    <th rowspan="2" class="metric-col">Bonus %</th>
                    <th rowspan="2" class="metric-col">Suggest Win %</th>
                    <th rowspan="2" class="metric-col">RTP %</th>
                    <th rowspan="2" class="metric-col">RTP FP %</th>
                    <th rowspan="2" class="sum-payout-col">Sum payout</th>
                    <th colspan="5">Bonus Ratios</th>
                    <th colspan="6" class="weights-group">Bonus Weights</th>
                    <th rowspan="2" class="total-counts-col">Total Counts</th>
                  </tr>
                  <tr>
                    <th>1</th>
                    <th>2</th>
                    <th>3</th>
                    <th>4</th>
                    <th>5</th>
                    <th class="base-weight-col">Base</th>
                    <th>1</th>
                    <th>2</th>
                    <th>3</th>
                    <th>4</th>
                    <th>5</th>
                  </tr>
                </thead>
                <tbody id="bonus-ratio-sum-body"></tbody>
              </table>
            </div>
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
      const bonusRatioBody = document.querySelector('#bonus-ratio-body');
      const bonusRatioSumBody = document.querySelector('#bonus-ratio-sum-body');
      const bonusSlotTotalInput = document.querySelector('#cfg-bonus-slot-total');
      const bonusRatioScroll = document.querySelector('#bonus-ratio-scroll');
      const bonusRatioScrollbarTop = document.querySelector('#bonus-ratio-scrollbar-top');
      const bonusRatioScrollbarInner = document.querySelector(
        '#bonus-ratio-scrollbar-top .bonus-ratio-scrollbar-inner',
      );

      const sumKeys = Array.from({ length: 26 }, (_, idx) => idx + 1);
      const sumInputs = new Map();
      const bonusRatioInputs = new Map();
      const slotPayoutInputs = new Map();
      const slotMetaInputs = new Map();

      const buildBonusSlotDefs = () => {
        const defs = [];
        const pushDef = (entry) => defs.push(entry);
        pushDef({ digitType: 'SMALL', selection: null, label: 'SMALL' });
        pushDef({ digitType: 'BIG', selection: null, label: 'BIG' });
        pushDef({ digitType: 'ODD', selection: null, label: 'ODD' });
        pushDef({ digitType: 'EVEN', selection: null, label: 'EVEN' });
        pushDef({ digitType: 'ANY_TRIPLE', selection: null, label: 'ANY TRIPLE' });

        for (let d = 0; d <= 9; d += 1) {
          pushDef({
            digitType: 'SINGLE',
            selection: String(d),
            label: 'SINGLE ' + String(d),
          });
        }

        for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
          pushDef({
            digitType: 'DOUBLE',
            selection: d + d,
            label: 'DOUBLE ' + d + d,
          });
        }

        for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
          pushDef({
            digitType: 'TRIPLE',
            selection: d + d + d,
            label: 'TRIPLE ' + d + d + d,
          });
        }

        for (let sum = 1; sum <= 26; sum += 1) {
          pushDef({
            digitType: 'SUM',
            selection: String(sum),
            label: 'SUM ' + String(sum),
            group: 'sum',
          });
        }

        return defs;
      };

      const bonusSlotDefs = buildBonusSlotDefs();

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
        if (authed) {
          scheduleBonusRatioScrollbarUpdate();
        }
      };

      const parseErrorMessage = async (response) => {
        try {
          const detail = await response.json();
          if (detail && typeof detail.message === 'string') {
            return detail.message;
          }
        } catch (error) {
          // Ignore JSON parse errors for empty bodies.
        }
        return response.statusText || 'Request failed';
      };

      const handleAuthFailure = (message) => {
        token = '';
        localStorage.removeItem(tokenKey);
        setAuthState(false);
        setStatus(loginStatus, message || 'Session expired. Please log in again.', true);
      };

      const apiFetch = async (path, options) => {
        const next = options || {};
        const headers = Object.assign({}, next.headers || {});
        headers['Content-Type'] = 'application/json';
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const response = await fetch(path, Object.assign({}, next, { headers }));
        if (!response.ok) {
          const message = await parseErrorMessage(response);
          if (response.status === 401 || response.status === 403) {
            handleAuthFailure(message || 'Session expired. Please log in again.');
          }
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

      const readOptionalNumber = (value, label) => {
        const raw = String(value || '').trim();
        if (!raw) return 0;
        const numberValue = Number(raw);
        if (!Number.isFinite(numberValue)) throw new Error(label + ' must be a number');
        if (numberValue < 0) throw new Error(label + ' must be >= 0');
        return numberValue;
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

      const formatPercent = (value) => {
        if (!Number.isFinite(value)) return '--';
        return value.toFixed(2) + '%';
      };

      const computeDigitSumSuggestWinPct = (sumValue) => {
        const sum = Number(sumValue);
        if (!Number.isFinite(sum)) return 0;
        let count = 0;
        for (let a = 0; a <= 9; a += 1) {
          for (let b = 0; b <= 9; b += 1) {
            const c = sum - a - b;
            if (c >= 0 && c <= 9) count += 1;
          }
        }
        return (count / 1000) * 100;
      };

      const getDefaultSuggestWinPct = (key) => {
        const [digitType, selectionRaw] = key.split('|');
        switch (digitType) {
          case 'SMALL':
          case 'BIG':
          case 'ODD':
          case 'EVEN':
            return 49.5;
          case 'ANY_TRIPLE':
            return 1;
          case 'DOUBLE':
            return 2.7;
          case 'TRIPLE':
            return 0.1;
          case 'SINGLE':
            return 27.1;
          case 'SUM':
            return computeDigitSumSuggestWinPct(selectionRaw);
          default:
            return 0;
        }
      };

      const collectWeightedEntries = (ratios, weights) => {
        const entries = [];
        const limit = Math.min(ratios.length, weights.length);
        for (let i = 0; i < limit; i += 1) {
          const ratio = Number(ratios[i].value);
          const weight = Number(weights[i].value);
          if (!Number.isFinite(ratio)) continue;
          if (!Number.isFinite(weight) || weight <= 0) continue;
          entries.push({ ratio, weight });
        }
        return entries;
      };

      const computeBonusPercent = (entries, totalRoll) => {
        if (!Number.isFinite(totalRoll) || totalRoll <= 0) return NaN;
        const weightSum = entries.reduce((sum, entry) => sum + entry.weight, 0);
        return weightSum <= 0 ? 0 : (weightSum / totalRoll) * 100;
      };

      const computeRtpPercent = (entries, suggestWinPct, baseRatio, totalRoll) => {
        if (!Number.isFinite(suggestWinPct)) return NaN;
        if (!entries.length) return suggestWinPct;
        const weightSum = entries.reduce((sum, entry) => sum + entry.weight, 0);
        const baseCount = Number.isFinite(totalRoll) ? Math.max(totalRoll - weightSum, 0) : 0;
        const totalCount = baseCount + weightSum;
        if (totalCount <= 0) return suggestWinPct;
        const ratioSum = entries.reduce((sum, entry) => sum + entry.ratio * entry.weight, 0);
        const weightedSum = (Number.isFinite(baseRatio) ? baseRatio : 0) * baseCount + ratioSum;
        const avgRatio = weightedSum / totalCount;
        return suggestWinPct * (1 + avgRatio);
      };

      const updateSlotMetrics = (key) => {
        const entry = bonusRatioInputs.get(key);
        const meta = slotMetaInputs.get(key);
        if (!entry || !meta) return;
        const entries = collectWeightedEntries(entry.ratios, entry.weights);
        const fallbackBaseWeight = Number(bonusSlotTotalInput?.value);
        const configuredFallback = Number.isFinite(fallbackBaseWeight) && fallbackBaseWeight > 0 ? fallbackBaseWeight : 100000;
        const baseWeightRaw = Number(meta.baseWeightInput?.value);
        const baseWeight =
          Number.isFinite(baseWeightRaw) && baseWeightRaw > 0 ? baseWeightRaw : configuredFallback;
        const bonusWeightSum = entries.reduce((sum, current) => sum + current.weight, 0);
        const totalCounts = baseWeight + bonusWeightSum;
        const totalRoll = totalCounts > 0 ? totalCounts : configuredFallback;
        const bonusPct = computeBonusPercent(entries, totalRoll);
        const suggestWinPct = Number(meta.suggestInput.value);
        const [digitType, selectionRaw] = key.split('|');
        const baseRatio =
          digitType === 'SUM'
            ? Number(sumInputs.get(Number(selectionRaw))?.value)
            : Number(slotPayoutInputs.get(key)?.value);
        const rtpPct = computeRtpPercent(entries, suggestWinPct, baseRatio, totalRoll);
        const rtpCap = Number(meta.rtpFoolProofInput.value);
        const cappedRtpPct =
          Number.isFinite(rtpCap) && rtpCap > 0 ? Math.min(rtpPct, rtpCap) : rtpPct;
        meta.bonusEl.textContent = formatPercent(bonusPct);
        meta.rtpEl.textContent = formatPercent(cappedRtpPct);
        if (meta.totalCountsEl) {
          meta.totalCountsEl.textContent = formatCount(totalCounts);
        }
      };

      const updateAllSlotMetrics = () => {
        slotMetaInputs.forEach((_, key) => updateSlotMetrics(key));
      };

      let syncingBonusScroll = false;
      const syncBonusRatioScroll = (source, target) => {
        if (!source || !target) return;
        syncingBonusScroll = true;
        requestAnimationFrame(() => {
          target.scrollLeft = source.scrollLeft;
          syncingBonusScroll = false;
        });
      };
      const updateBonusRatioScrollbarWidth = () => {
        if (!bonusRatioScroll || !bonusRatioScrollbarInner || !bonusRatioScrollbarTop) return;
        const scrollWidth = bonusRatioScroll.scrollWidth;
        const clientWidth = bonusRatioScroll.clientWidth;
        const width = Math.max(scrollWidth, clientWidth + 1);
        bonusRatioScrollbarInner.style.width = width + 'px';
        bonusRatioScrollbarTop.scrollLeft = bonusRatioScroll.scrollLeft;
      };
      const scheduleBonusRatioScrollbarUpdate = () => {
        if (!bonusRatioScroll) return;
        requestAnimationFrame(updateBonusRatioScrollbarWidth);
        setTimeout(updateBonusRatioScrollbarWidth, 60);
      };
      if (bonusRatioScroll && bonusRatioScrollbarTop) {
        bonusRatioScroll.addEventListener('scroll', () => {
          if (syncingBonusScroll) return;
          syncBonusRatioScroll(bonusRatioScroll, bonusRatioScrollbarTop);
        });
        bonusRatioScrollbarTop.addEventListener('scroll', () => {
          if (syncingBonusScroll) return;
          syncBonusRatioScroll(bonusRatioScrollbarTop, bonusRatioScroll);
        });
        window.addEventListener('resize', updateBonusRatioScrollbarWidth);
      }

      if (bonusSlotTotalInput) {
        bonusSlotTotalInput.addEventListener('input', updateAllSlotMetrics);
      }

      const resolveSlotPayoutValue = (digitPayouts, slotKey) => {
        if (!digitPayouts) return null;
        const bySlotValue = digitPayouts.bySlot && digitPayouts.bySlot[slotKey];
        if (typeof bySlotValue === 'number' && Number.isFinite(bySlotValue)) {
          return bySlotValue;
        }
        const digitType = slotKey.split('|')[0];
        switch (digitType) {
          case 'SMALL':
          case 'ODD':
          case 'EVEN':
          case 'BIG':
            return digitPayouts.smallBigOddEven;
          case 'ANY_TRIPLE':
            return digitPayouts.anyTriple;
          case 'DOUBLE':
            return digitPayouts.double;
          case 'TRIPLE':
            return digitPayouts.triple;
          case 'SINGLE':
            return digitPayouts.single?.single;
          default:
            return null;
        }
      };

      const setSlotPayoutInputs = (digitPayouts) => {
        slotPayoutInputs.forEach((input, key) => {
          const value = resolveSlotPayoutValue(digitPayouts, key);
          input.value = value !== undefined && value !== null ? String(value) : '';
        });
      };

      const setSlotMetaInputs = (bySlotMeta) => {
        const hasAnyMeta =
          bySlotMeta &&
          Object.values(bySlotMeta).some((entry) =>
            Number.isFinite(entry?.suggestWinPct) && entry.suggestWinPct > 0,
          );
        slotMetaInputs.forEach((entry, key) => {
          const configEntry = bySlotMeta ? bySlotMeta[key] : null;
          const suggestValue =
            typeof configEntry?.suggestWinPct === 'number' &&
            Number.isFinite(configEntry.suggestWinPct)
              ? configEntry.suggestWinPct
              : null;
          const defaultSuggest = getDefaultSuggestWinPct(key);
          const isSumKey = key.startsWith('SUM|');
          entry.suggestInput.value =
            suggestValue !== null && hasAnyMeta && (!isSumKey || suggestValue > 0)
              ? String(suggestValue)
              : String(defaultSuggest);
          entry.rtpFoolProofInput.value =
            typeof configEntry?.rtpFoolProofPct === 'number' &&
            Number.isFinite(configEntry.rtpFoolProofPct)
              ? String(configEntry.rtpFoolProofPct)
              : '';
          const baseWeightValue =
            typeof configEntry?.totalCounts === 'number' &&
            Number.isFinite(configEntry.totalCounts) &&
            configEntry.totalCounts > 0
              ? configEntry.totalCounts
              : 100000;
          entry.baseWeightInput.value = String(baseWeightValue);
        });
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

      const buildBonusRatioTable = () => {
        if (!bonusRatioBody && !bonusRatioSumBody) return;
        if (bonusRatioBody) bonusRatioBody.innerHTML = '';
        if (bonusRatioSumBody) bonusRatioSumBody.innerHTML = '';
        bonusRatioInputs.clear();
        sumInputs.clear();
        slotPayoutInputs.clear();
        slotMetaInputs.clear();

        bonusSlotDefs.forEach((slot) => {
          const key = slot.digitType + '|' + (slot.selection ?? '');
          const row = document.createElement('tr');
          const labelCell = document.createElement('td');
          labelCell.textContent = slot.label;
          labelCell.className = 'slot-label';
          row.appendChild(labelCell);

          const baseWeightInput = document.createElement('input');
          baseWeightInput.type = 'number';
          baseWeightInput.min = '0';
          baseWeightInput.step = '1';
          baseWeightInput.className = 'base-weight-input';
          const baseWeightCell = document.createElement('td');
          baseWeightCell.className = 'base-weight-cell';
          baseWeightCell.appendChild(baseWeightInput);
          const totalCountsValueEl = document.createElement('span');
          totalCountsValueEl.className = 'total-counts-value';
          totalCountsValueEl.textContent = '0';

          if (slot.group === 'sum') {
            const bonusCell = document.createElement('td');
            bonusCell.className = 'metric-cell';
            const bonusValue = document.createElement('span');
            bonusValue.className = 'metric-value';
            bonusValue.textContent = '--';
            bonusCell.appendChild(bonusValue);
            row.appendChild(bonusCell);

            const suggestCell = document.createElement('td');
            suggestCell.className = 'metric-input';
            const suggestInput = document.createElement('input');
            suggestInput.type = 'number';
            suggestInput.min = '0';
            suggestInput.step = '0.01';
            suggestCell.appendChild(suggestInput);
            row.appendChild(suggestCell);

            const rtpCell = document.createElement('td');
            rtpCell.className = 'metric-cell';
            const rtpValue = document.createElement('span');
            rtpValue.className = 'metric-value';
            rtpValue.textContent = '--';
            rtpCell.appendChild(rtpValue);
            row.appendChild(rtpCell);

            const rtpFoolProofCell = document.createElement('td');
            rtpFoolProofCell.className = 'metric-input';
            const rtpFoolProofInput = document.createElement('input');
            rtpFoolProofInput.type = 'number';
            rtpFoolProofInput.min = '0';
            rtpFoolProofInput.step = '0.01';
            rtpFoolProofCell.appendChild(rtpFoolProofInput);
            row.appendChild(rtpFoolProofCell);

            const payoutCell = document.createElement('td');
            payoutCell.className = 'sum-payout-col';
            const payoutInput = document.createElement('input');
            payoutInput.type = 'number';
            payoutInput.min = '0';
            payoutInput.step = '0.01';
            payoutInput.className = 'sum-payout-input';
            payoutInput.dataset.sumKey = String(slot.selection ?? '');
            payoutCell.appendChild(payoutInput);
            row.appendChild(payoutCell);
            const sumKey = Number(slot.selection);
            if (Number.isFinite(sumKey)) {
              sumInputs.set(sumKey, payoutInput);
            }

            slotMetaInputs.set(key, {
              bonusEl: bonusValue,
              suggestInput,
              rtpEl: rtpValue,
              rtpFoolProofInput,
              baseWeightInput,
              totalCountsEl: totalCountsValueEl,
              label: slot.label,
            });
            payoutInput.addEventListener('input', () => updateSlotMetrics(key));
            suggestInput.addEventListener('input', () => updateSlotMetrics(key));
            rtpFoolProofInput.addEventListener('input', () => updateSlotMetrics(key));
            baseWeightInput.addEventListener('input', () => updateSlotMetrics(key));
          } else {
            const bonusCell = document.createElement('td');
            bonusCell.className = 'metric-cell';
            const bonusValue = document.createElement('span');
            bonusValue.className = 'metric-value';
            bonusValue.textContent = '--';
            bonusCell.appendChild(bonusValue);
            row.appendChild(bonusCell);

            const suggestCell = document.createElement('td');
            suggestCell.className = 'metric-input';
            const suggestInput = document.createElement('input');
            suggestInput.type = 'number';
            suggestInput.min = '0';
            suggestInput.step = '0.01';
            suggestCell.appendChild(suggestInput);
            row.appendChild(suggestCell);

            const rtpCell = document.createElement('td');
            rtpCell.className = 'metric-cell';
            const rtpValue = document.createElement('span');
            rtpValue.className = 'metric-value';
            rtpValue.textContent = '--';
            rtpCell.appendChild(rtpValue);
            row.appendChild(rtpCell);

            const rtpFoolProofCell = document.createElement('td');
            rtpFoolProofCell.className = 'metric-input';
            const rtpFoolProofInput = document.createElement('input');
            rtpFoolProofInput.type = 'number';
            rtpFoolProofInput.min = '0';
            rtpFoolProofInput.step = '0.01';
            rtpFoolProofCell.appendChild(rtpFoolProofInput);
            row.appendChild(rtpFoolProofCell);

            const payoutCell = document.createElement('td');
            payoutCell.className = 'payout-cell';
            const payoutInput = document.createElement('input');
            payoutInput.type = 'number';
            payoutInput.min = '0';
            payoutInput.step = '0.01';
            payoutInput.className = 'payout-input';
            payoutInput.dataset.slotKey = key;
            payoutCell.appendChild(payoutInput);
            row.appendChild(payoutCell);
            slotPayoutInputs.set(key, payoutInput);
            payoutInput.addEventListener('input', () => updateSlotMetrics(key));

            slotMetaInputs.set(key, {
              bonusEl: bonusValue,
              suggestInput,
              rtpEl: rtpValue,
              rtpFoolProofInput,
              baseWeightInput,
              totalCountsEl: totalCountsValueEl,
              label: slot.label,
            });
          }

          const ratios = [];
          const weights = [];
          for (let i = 0; i < 5; i += 1) {
            const ratioInput = document.createElement('input');
            ratioInput.type = 'number';
            ratioInput.min = '0';
            ratioInput.step = '0.01';
            const cell = document.createElement('td');
            cell.appendChild(ratioInput);
            row.appendChild(cell);
            ratios.push(ratioInput);
            ratioInput.addEventListener('input', () => updateSlotMetrics(key));
          }

          row.appendChild(baseWeightCell);

          for (let i = 0; i < 5; i += 1) {
            const weightInput = document.createElement('input');
            weightInput.type = 'number';
            weightInput.min = '0';
            weightInput.step = '1';
            weightInput.className = 'weight-input';
            const cell = document.createElement('td');
            cell.className = 'weight-cell';
            cell.appendChild(weightInput);
            row.appendChild(cell);
            weights.push(weightInput);
            weightInput.addEventListener('input', () => updateSlotMetrics(key));
          }

          bonusRatioInputs.set(key, { ratios, weights, label: slot.label });
          const meta = slotMetaInputs.get(key);
          if (meta?.totalCountsEl) {
            const totalCountsCell = document.createElement('td');
            totalCountsCell.className = 'metric-cell total-counts-col total-counts-cell';
            totalCountsCell.appendChild(meta.totalCountsEl);
            row.appendChild(totalCountsCell);
          }
          const targetBody = slot.group === 'sum' ? bonusRatioSumBody : bonusRatioBody;
          if (targetBody) {
            targetBody.appendChild(row);
          }
        });
        scheduleBonusRatioScrollbarUpdate();
      };

      const setBonusRatioInputs = (digitBonusRatios) => {
        bonusRatioInputs.forEach((entry, key) => {
          const configEntry = digitBonusRatios ? digitBonusRatios[key] : null;
          const ratioValues = Array.isArray(configEntry?.ratios)
            ? configEntry.ratios
            : [];
          const weightValues = Array.isArray(configEntry?.weights)
            ? configEntry.weights
            : [];

          entry.ratios.forEach((input, idx) => {
            const value = ratioValues[idx];
            input.value =
              typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
          });
          entry.weights.forEach((input, idx) => {
            const value = weightValues[idx];
            input.value =
              typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
          });
        });
      };

      const setConfigForm = (config) => {
        setValue('#cfg-betting-duration', config.bettingDurationMs);
        setValue('#cfg-result-duration', config.resultDurationMs);
        setValue('#cfg-result-display-duration', config.resultDisplayDurationMs);
        setValue('#cfg-snapshot-interval', config.priceSnapshotInterval);
        setValue('#cfg-bonus-slot-total', config.bonusSlotChanceTotal);
        setValue('#cfg-min-bet', config.minBetAmount);
        setValue('#cfg-max-bet', config.maxBetAmount);
        setValue('#cfg-payout-up', config.payoutMultiplierUp);
        setValue('#cfg-payout-down', config.payoutMultiplierDown);
        setValue('#cfg-digit-single-double', config.digitPayouts.single.double);
        setValue('#cfg-digit-single-triple', config.digitPayouts.single.triple);
        sumKeys.forEach((key) => {
          const input = sumInputs.get(key);
          if (!input) return;
          const value = config.digitPayouts.sum[key];
          input.value = value !== undefined ? String(value) : '';
        });
        setSlotPayoutInputs(config.digitPayouts);
        setSlotMetaInputs(config.digitPayouts.bySlotMeta);
        setBonusRatioInputs(config.digitBonusRatios);
        updateAllSlotMetrics();
        scheduleBonusRatioScrollbarUpdate();
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

        const slotPayouts = {};
        slotPayoutInputs.forEach((input, key) => {
          const value = Number(input.value);
          if (!Number.isFinite(value)) {
            throw new Error('Payout ratio for ' + key + ' is required');
          }
          slotPayouts[key] = value;
        });

        const slotMeta = {};
        slotMetaInputs.forEach((entry, key) => {
          const suggestWinPct = readOptionalNumber(
            entry.suggestInput.value,
            entry.label + ' suggest win %',
          );
          const rtpFoolProofPct = readOptionalNumber(
            entry.rtpFoolProofInput.value,
            entry.label + ' RTP fool proof %',
          );
          const baseWeightRaw = readOptionalNumber(
            entry.baseWeightInput.value,
            entry.label + ' base weight',
          );
          const baseWeight = baseWeightRaw > 0 ? baseWeightRaw : 100000;
          slotMeta[key] = { suggestWinPct, rtpFoolProofPct, totalCounts: baseWeight };
        });

        const digitBonusRatios = {};
        bonusRatioInputs.forEach((entry, key) => {
          const ratios = entry.ratios.map((input, idx) =>
            readOptionalNumber(
              input.value,
              entry.label + ' bonus ratio ' + String(idx + 1),
            ),
          );
          const weights = entry.weights.map((input, idx) =>
            readOptionalNumber(
              input.value,
              entry.label + ' bonus weight ' + String(idx + 1),
            ),
          );
          digitBonusRatios[key] = { ratios, weights };
        });

        const requireSlotPayout = (key, label) => {
          const value = slotPayouts[key];
          if (!Number.isFinite(value)) {
            throw new Error(label + ' payout ratio is required');
          }
          return value;
        };

        return {
          bettingDurationMs: readNumber('#cfg-betting-duration', 'Betting duration'),
          resultDurationMs: readNumber('#cfg-result-duration', 'Result duration'),
          resultDisplayDurationMs: readNumber('#cfg-result-display-duration', 'Result display duration'),
          minBetAmount: readNumber('#cfg-min-bet', 'Min bet amount'),
          maxBetAmount: readNumber('#cfg-max-bet', 'Max bet amount'),
          payoutMultiplierUp: readNumber('#cfg-payout-up', 'Hi-Lo payout up'),
          payoutMultiplierDown: readNumber('#cfg-payout-down', 'Hi-Lo payout down'),
          priceSnapshotInterval: readNumber('#cfg-snapshot-interval', 'Price snapshot interval'),
          bonusSlotChanceTotal: readNumber('#cfg-bonus-slot-total', 'Bonus slot chance total'),
          digitPayouts: {
            smallBigOddEven: requireSlotPayout('SMALL|', 'Small/Big/Odd/Even'),
            anyTriple: requireSlotPayout('ANY_TRIPLE|', 'Any triple'),
            double: requireSlotPayout('DOUBLE|00', 'Double'),
            triple: requireSlotPayout('TRIPLE|000', 'Triple'),
            single: {
              single: requireSlotPayout('SINGLE|0', 'Single payout (1x)'),
              double: readNumber('#cfg-digit-single-double', 'Single payout (2x)'),
              triple: readNumber('#cfg-digit-single-triple', 'Single payout (3x)'),
            },
            sum: sum,
            bySlot: slotPayouts,
            bySlotMeta: slotMeta,
          },
          digitBonusRatios,
        };
      };

      const formatNumber = (value) => {
        if (!Number.isFinite(value)) return '--';
        return value.toFixed(2).replace(/\\.00$/, '');
      };

      const formatCount = (value) => {
        if (!Number.isFinite(value)) return '--';
        return Math.round(value).toLocaleString('en-US');
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
        buildBonusRatioTable();
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
        let data;
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
          data = await res.json();
        } catch (error) {
          setStatus(loginStatus, error.message || 'Login failed', true);
          return;
        }

        if (!data || !data.accessToken) {
          setStatus(loginStatus, 'Login failed: missing token', true);
          return;
        }
        if (data.user && data.user.isAdmin === false) {
          handleAuthFailure('Admin access required.');
          return;
        }

        token = data.accessToken;
        localStorage.setItem(tokenKey, token);
        setStatus(loginStatus, 'Login successful.');
        setAuthState(true);
        loadConfig().catch((error) =>
          setStatus(configStatus, error.message || 'Failed to load config', true),
        );
        loadRtp().catch((error) =>
          setStatus(rtpStatus, error.message || 'Failed to load RTP', true),
        );
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
