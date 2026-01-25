import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminStatsService } from './admin-stats.service';
import { AdminDataService } from './admin-data.service';
import { AdminAccountsService } from './admin-accounts.service';
import {
  QueryRoundsDto,
  QueryBetsDto,
  QueryPlayersDto,
  UpdatePlayerStatusDto,
  QueryTransfersDto,
  QueryTransactionsDto,
  QueryMerchantsDto,
  CreateMerchantDto,
  UpdateMerchantDto,
  QueryPriceSnapshotsDto,
  QueryPlayerLoginsDto,
  QueryAdminAccountsDto,
  CreateAdminAccountDto,
  UpdateAdminAccountDto,
  QueryLoginRecordsDto,
} from './dto';
// Using inline HTML with full bonus ratio tables
// import { ADMIN_PAGE_HTML } from './admin-page.html';

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
      /* Tabs */
      .tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; }
      .tab-btn {
        padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: var(--radius-sm);
        background: transparent; color: var(--muted); font-size: 0.85rem; font-weight: 500;
        cursor: pointer; transition: all 0.15s ease;
      }
      .tab-btn:hover { background: var(--panel-strong); color: var(--text); }
      .tab-btn.active { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
      .tab-content { display: none; }
      .tab-content.active { display: block; }
      /* Data tables */
      .filters { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end; margin-bottom: 1rem; }
      .filters label { min-width: 120px; }
      .filters input, .filters select { min-width: 100px; }
      select { padding: 0.55rem 0.7rem; border-radius: var(--radius-sm); border: 1px solid var(--border); font-size: 0.95rem; background: #0b1320; color: var(--text); }
      select:focus { outline: none; border-color: rgba(56, 189, 248, 0.7); }
      .table-wrapper { overflow-x: auto; }
      .pagination { display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem; justify-content: flex-end; }
      .pagination button { padding: 0.4rem 0.8rem; font-size: 0.85rem; }
      .pagination span { color: var(--muted); font-size: 0.85rem; }
      .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 999px; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; }
      .badge.success { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
      .badge.warning { background: rgba(234, 179, 8, 0.2); color: #facc15; }
      .badge.error { background: rgba(239, 68, 68, 0.2); color: #f87171; }
      .badge.info { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
      button.small { padding: 0.35rem 0.75rem; font-size: 0.8rem; }
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

      <!-- Main Content with Tabs -->
      <div id="main-content" class="hidden">
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
      <section class="section" id="config-section">
        <h2>Game Configuration</h2>
        <div class="grid" style="margin-bottom: 1rem;">
          <label>
            Select Merchant
            <select id="cfg-merchant-select">
              <option value="">Global (Default)</option>
            </select>
          </label>
          <div style="display: flex; gap: 0.5rem; align-items: flex-end;">
            <button type="button" id="cfg-copy-global" class="secondary small">Copy from Global</button>
            <button type="button" id="cfg-delete-merchant" class="secondary small" style="display:none;">Delete Merchant Config</button>
          </div>
        </div>
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
        </div>

        <!-- Daily RTP Tab -->
        <div class="tab-content" id="tab-rtp">
      <section class="section" id="rtp-section">
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

        <!-- Rounds Tab -->
        <div class="tab-content" id="tab-rounds">
          <section class="section">
            <h2>Game Rounds</h2>
            <form id="rounds-form" class="filters">
              <label>Round ID<input id="rounds-id" type="number" /></label>
              <label>Status<select id="rounds-status"><option value="">All</option><option value="PENDING">Pending</option><option value="BETTING">Betting</option><option value="RESULT_PENDING">Result Pending</option><option value="COMPLETED">Completed</option></select></label>
              <label>Start<input id="rounds-start" type="date" /></label>
              <label>End<input id="rounds-end" type="date" /></label>
              <button class="primary" type="submit">Search</button>
            </form>
            <div class="status" id="rounds-status-msg"></div>
            <div class="table-wrapper"><table><thead><tr><th>ID</th><th>Status</th><th>Start</th><th>Lock</th><th>End</th><th>Locked Price</th><th>Final Price</th><th>Result</th></tr></thead><tbody id="rounds-table-body"></tbody></table></div>
            <div class="pagination" id="rounds-pagination"></div>
          </section>
        </div>

        <!-- Bets Tab -->
        <div class="tab-content" id="tab-bets">
          <section class="section">
            <h2>Bet Records</h2>
            <form id="bets-form" class="filters">
              <label>Bet ID<input id="bets-id" type="text" /></label>
              <label>Round<input id="bets-round" type="number" /></label>
              <label>Merchant<input id="bets-merchant" type="text" /></label>
              <label>Player<input id="bets-player" type="text" /></label>
              <label>Result<select id="bets-result"><option value="">All</option><option value="WIN">Win</option><option value="LOSE">Lose</option><option value="PENDING">Pending</option><option value="REFUND">Refund</option></select></label>
              <label>Start<input id="bets-start" type="date" /></label>
              <label>End<input id="bets-end" type="date" /></label>
              <button class="primary" type="submit">Search</button>
            </form>
            <div class="status" id="bets-status"></div>
            <div class="table-wrapper"><table><thead><tr><th>ID</th><th>Round</th><th>Player</th><th>Type</th><th>Selection</th><th>Amount</th><th>Odds</th><th>Payout</th><th>Result</th><th>Time</th></tr></thead><tbody id="bets-table-body"></tbody></table></div>
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
              <label>Status<select id="players-status"><option value="">All</option><option value="ENABLED">Enabled</option><option value="DISABLED">Disabled</option></select></label>
              <button class="primary" type="submit">Search</button>
            </form>
            <div class="status" id="players-status-msg"></div>
            <div class="table-wrapper"><table><thead><tr><th>ID</th><th>Merchant</th><th>Account</th><th>Balance</th><th>Currency</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody id="players-table-body"></tbody></table></div>
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
              <label>Active<select id="merchants-active"><option value="">All</option><option value="true">Active</option><option value="false">Inactive</option></select></label>
              <button class="primary" type="submit">Search</button>
              <button type="button" id="merchants-new" class="secondary">+ New</button>
            </form>
            <div class="status" id="merchants-status"></div>
            <div class="table-wrapper"><table><thead><tr><th>ID</th><th>Merchant ID</th><th>Name</th><th>Hash Key</th><th>Active</th><th>Created</th><th>Actions</th></tr></thead><tbody id="merchants-table-body"></tbody></table></div>
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
              <label>Type<select id="transfers-type"><option value="">All</option><option value="1">In</option><option value="2">Out</option></select></label>
              <label>Start<input id="transfers-start" type="date" /></label>
              <label>End<input id="transfers-end" type="date" /></label>
              <button class="primary" type="submit">Search</button>
            </form>
            <div class="status" id="transfers-status"></div>
            <div class="table-wrapper"><table><thead><tr><th>ID</th><th>Merchant</th><th>Player</th><th>Order No</th><th>Type</th><th>Amount</th><th>Balance After</th><th>Time</th></tr></thead><tbody id="transfers-table-body"></tbody></table></div>
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
              <label>Type<select id="transactions-type"><option value="">All</option><option value="TRANSFER_IN">Transfer In</option><option value="TRANSFER_OUT">Transfer Out</option><option value="BET">Bet</option><option value="PAYOUT">Payout</option><option value="CANCEL">Cancel</option><option value="BONUS">Bonus</option></select></label>
              <label>Start<input id="transactions-start" type="date" /></label>
              <label>End<input id="transactions-end" type="date" /></label>
              <button class="primary" type="submit">Search</button>
            </form>
            <div class="status" id="transactions-status"></div>
            <div class="table-wrapper"><table><thead><tr><th>ID</th><th>Player</th><th>Type</th><th>Reference</th><th>Before</th><th>Amount</th><th>After</th><th>Time</th></tr></thead><tbody id="transactions-table-body"></tbody></table></div>
            <div class="pagination" id="transactions-pagination"></div>
          </section>
        </div>

      </div>
    </div>

    <script>
      const tokenKey = 'adminToken';
      let token = localStorage.getItem(tokenKey) || '';
      const $ = (sel) => document.querySelector(sel);
      const $$ = (sel) => document.querySelectorAll(sel);
      const loginSection = $('#login-section');
      const mainContent = $('#main-content');
      const loginForm = $('#login-form');
      const loginStatus = $('#login-status');
      const logoutBtn = $('#logout-btn');
      const configSection = $('#config-section');
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
        if (mainContent) mainContent.classList.toggle('hidden', !authed);
        if (logoutBtn) logoutBtn.classList.toggle('hidden', !authed);
        if (authed) {
          scheduleBonusRatioScrollbarUpdate();
        }
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

      // Pagination state
      const pageState = { rounds: 0, bets: 0, players: 0, merchants: 0, transfers: 0, transactions: 0 };
      const pageLimit = 20;
      const formatDate = (iso) => iso ? new Date(iso).toLocaleString() : '--';
      const formatNum = (v) => Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '--';

      // Rounds
      const loadRounds = async (page = 0) => {
        pageState.rounds = page;
        const statusEl = $('#rounds-status-msg');
        setStatus(statusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageLimit });
          const id = $('#rounds-id')?.value; const status = $('#rounds-status')?.value;
          const start = $('#rounds-start')?.value; const end = $('#rounds-end')?.value;
          if (id) params.set('roundId', id); if (status) params.set('status', status);
          if (start) params.set('start', start); if (end) params.set('end', end);
          const data = await apiFetch('/admin/rounds?' + params);
          $('#rounds-table-body').innerHTML = data.items.length ? data.items.map(r => '<tr><td>'+r.id+'</td><td><span class="badge '+(r.status==='COMPLETED'?'success':'info')+'">'+r.status+'</span></td><td>'+formatDate(r.startTime)+'</td><td>'+formatDate(r.lockTime)+'</td><td>'+formatDate(r.endTime)+'</td><td>'+formatNum(r.lockedPrice)+'</td><td>'+formatNum(r.finalPrice)+'</td><td>'+(r.winningSide||'--')+' '+(r.digitResult?'('+r.digitResult+')':'')+'</td></tr>').join('') : '<tr><td colspan="8">No data</td></tr>';
          renderPagination('rounds', data, loadRounds);
          setStatus(statusEl, '');
        } catch (err) { setStatus(statusEl, err.message, true); }
      };
      $('#rounds-form')?.addEventListener('submit', (e) => { e.preventDefault(); loadRounds(0); });

      // Bets
      const loadBets = async (page = 0) => {
        pageState.bets = page;
        const statusEl = $('#bets-status');
        setStatus(statusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageLimit });
          const betId = $('#bets-id')?.value; const roundId = $('#bets-round')?.value;
          const merchant = $('#bets-merchant')?.value; const player = $('#bets-player')?.value;
          const result = $('#bets-result')?.value; const start = $('#bets-start')?.value; const end = $('#bets-end')?.value;
          if (betId) params.set('betId', betId); if (roundId) params.set('roundId', roundId);
          if (merchant) params.set('merchantId', merchant); if (player) params.set('playerId', player);
          if (result) params.set('result', result); if (start) params.set('start', start); if (end) params.set('end', end);
          const data = await apiFetch('/admin/bets?' + params);
          $('#bets-table-body').innerHTML = data.items.length ? data.items.map(b => '<tr><td title="'+b.id+'">'+b.id.slice(0,8)+'...</td><td>'+b.roundId+'</td><td>'+(b.playerAccount||b.playerId)+'</td><td>'+b.betType+'</td><td>'+(b.digitType||b.side||'--')+' '+(b.selection||'')+'</td><td>'+formatNum(b.amount)+'</td><td>'+b.odds+'</td><td>'+formatNum(b.payout)+'</td><td><span class="badge '+(b.result==='WIN'?'success':b.result==='LOSE'?'error':'info')+'">'+b.result+'</span></td><td>'+formatDate(b.createdAt)+'</td></tr>').join('') : '<tr><td colspan="10">No data</td></tr>';
          renderPagination('bets', data, loadBets);
          setStatus(statusEl, '');
        } catch (err) { setStatus(statusEl, err.message, true); }
      };
      $('#bets-form')?.addEventListener('submit', (e) => { e.preventDefault(); loadBets(0); });

      // Players
      const loadPlayers = async (page = 0) => {
        pageState.players = page;
        const statusEl = $('#players-status-msg');
        setStatus(statusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageLimit });
          const merchant = $('#players-merchant')?.value; const account = $('#players-account')?.value; const status = $('#players-status')?.value;
          if (merchant) params.set('merchantId', merchant); if (account) params.set('account', account); if (status) params.set('status', status);
          const data = await apiFetch('/admin/players?' + params);
          $('#players-table-body').innerHTML = data.items.length ? data.items.map(p => '<tr><td title="'+p.id+'">'+p.id.slice(0,8)+'...</td><td>'+(p.merchantId||'--')+'</td><td>'+(p.merchantAccount||p.account)+'</td><td>'+formatNum(p.balance)+'</td><td>'+p.currency+'</td><td><span class="badge '+(p.status==='ENABLED'?'success':'error')+'">'+p.status+'</span></td><td>'+formatDate(p.createdAt)+'</td><td><button class="small secondary" onclick="togglePlayerStatus(\\''+p.id+'\\',\\''+p.status+'\\')">'+(p.status==='ENABLED'?'Disable':'Enable')+'</button></td></tr>').join('') : '<tr><td colspan="8">No data</td></tr>';
          renderPagination('players', data, loadPlayers);
          setStatus(statusEl, '');
        } catch (err) { setStatus(statusEl, err.message, true); }
      };
      $('#players-form')?.addEventListener('submit', (e) => { e.preventDefault(); loadPlayers(0); });
      window.togglePlayerStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'ENABLED' ? 'DISABLED' : 'ENABLED';
        if (!confirm('Change status to ' + newStatus + '?')) return;
        try { await apiFetch('/admin/players/' + id + '/status', { method: 'PUT', body: JSON.stringify({ status: newStatus }) }); loadPlayers(pageState.players); } catch (err) { alert(err.message); }
      };

      // Merchants
      const loadMerchants = async (page = 0) => {
        pageState.merchants = page;
        const statusEl = $('#merchants-status');
        setStatus(statusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageLimit });
          const id = $('#merchants-id')?.value; const name = $('#merchants-name')?.value; const active = $('#merchants-active')?.value;
          if (id) params.set('merchantId', id); if (name) params.set('name', name); if (active) params.set('isActive', active);
          const data = await apiFetch('/admin/merchants?' + params);
          $('#merchants-table-body').innerHTML = data.items.length ? data.items.map(m => '<tr><td title="'+m.id+'">'+m.id.slice(0,8)+'...</td><td>'+m.merchantId+'</td><td>'+m.name+'</td><td>'+m.hashKeyMasked+'</td><td><span class="badge '+(m.isActive?'success':'error')+'">'+(m.isActive?'Active':'Inactive')+'</span></td><td>'+formatDate(m.createdAt)+'</td><td><button class="small secondary" onclick="editMerchant(\\''+m.id+'\\')">Edit</button></td></tr>').join('') : '<tr><td colspan="7">No data</td></tr>';
          renderPagination('merchants', data, loadMerchants);
          setStatus(statusEl, '');
        } catch (err) { setStatus(statusEl, err.message, true); }
      };
      $('#merchants-form')?.addEventListener('submit', (e) => { e.preventDefault(); loadMerchants(0); });
      $('#merchants-new')?.addEventListener('click', () => {
        const merchantId = prompt('Merchant ID:'); if (!merchantId) return;
        const name = prompt('Name:'); if (!name) return;
        const hashKey = prompt('Hash Key (min 8 chars):'); if (!hashKey || hashKey.length < 8) { alert('Hash key must be 8+ chars'); return; }
        apiFetch('/admin/merchants', { method: 'POST', body: JSON.stringify({ merchantId, name, hashKey }) }).then(() => loadMerchants(0)).catch(err => alert(err.message));
      });
      window.editMerchant = async (id) => {
        const name = prompt('New name (empty to skip):'); const hashKey = prompt('New hash key (empty to skip):'); const activeStr = prompt('Active? (true/false, empty to skip):');
        const updates = {}; if (name) updates.name = name; if (hashKey) updates.hashKey = hashKey; if (activeStr === 'true') updates.isActive = true; if (activeStr === 'false') updates.isActive = false;
        if (!Object.keys(updates).length) return;
        try { await apiFetch('/admin/merchants/' + id, { method: 'PUT', body: JSON.stringify(updates) }); loadMerchants(pageState.merchants); } catch (err) { alert(err.message); }
      };

      // Transfers
      const loadTransfers = async (page = 0) => {
        pageState.transfers = page;
        const statusEl = $('#transfers-status');
        setStatus(statusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageLimit });
          const merchant = $('#transfers-merchant')?.value; const account = $('#transfers-account')?.value; const type = $('#transfers-type')?.value;
          const start = $('#transfers-start')?.value; const end = $('#transfers-end')?.value;
          if (merchant) params.set('merchantId', merchant); if (account) params.set('account', account); if (type) params.set('type', type);
          if (start) params.set('start', start); if (end) params.set('end', end);
          const data = await apiFetch('/admin/transfers?' + params);
          $('#transfers-table-body').innerHTML = data.items.length ? data.items.map(t => '<tr><td title="'+t.visibleId+'">'+t.visibleId.slice(0,8)+'...</td><td>'+t.merchantId+'</td><td>'+(t.playerAccount||t.playerId)+'</td><td>'+t.orderNo+'</td><td><span class="badge '+(t.type===1?'success':'warning')+'">'+(t.type===1?'IN':'OUT')+'</span></td><td>'+formatNum(t.amount)+'</td><td>'+formatNum(t.balanceAfter)+'</td><td>'+formatDate(t.createdAt)+'</td></tr>').join('') : '<tr><td colspan="8">No data</td></tr>';
          renderPagination('transfers', data, loadTransfers);
          setStatus(statusEl, '');
        } catch (err) { setStatus(statusEl, err.message, true); }
      };
      $('#transfers-form')?.addEventListener('submit', (e) => { e.preventDefault(); loadTransfers(0); });

      // Transactions
      const loadTransactions = async (page = 0) => {
        pageState.transactions = page;
        const statusEl = $('#transactions-status');
        setStatus(statusEl, 'Loading...');
        try {
          const params = new URLSearchParams({ page, limit: pageLimit });
          const merchant = $('#transactions-merchant')?.value; const account = $('#transactions-account')?.value; const type = $('#transactions-type')?.value;
          const start = $('#transactions-start')?.value; const end = $('#transactions-end')?.value;
          if (merchant) params.set('merchantId', merchant); if (account) params.set('account', account); if (type) params.set('type', type);
          if (start) params.set('start', start); if (end) params.set('end', end);
          const data = await apiFetch('/admin/transactions?' + params);
          $('#transactions-table-body').innerHTML = data.items.length ? data.items.map(t => '<tr><td title="'+t.id+'">'+t.id.slice(0,8)+'...</td><td>'+(t.playerAccount||t.playerId)+'</td><td><span class="badge info">'+t.type+'</span></td><td>'+(t.referenceId||'--')+'</td><td>'+formatNum(t.balanceBefore)+'</td><td style="color:'+(t.amount>=0?'#4ade80':'#f87171')+'">'+(t.amount>=0?'+':'')+formatNum(t.amount)+'</td><td>'+formatNum(t.balanceAfter)+'</td><td>'+formatDate(t.createdAt)+'</td></tr>').join('') : '<tr><td colspan="8">No data</td></tr>';
          renderPagination('transactions', data, loadTransactions);
          setStatus(statusEl, '');
        } catch (err) { setStatus(statusEl, err.message, true); }
      };
      $('#transactions-form')?.addEventListener('submit', (e) => { e.preventDefault(); loadTransactions(0); });

      // Pagination helper
      const renderPagination = (key, data, loadFn) => {
        const el = $('#' + key + '-pagination');
        if (!el) return;
        const { page, hasNext } = data;
        el.innerHTML = '<button '+(page===0?'disabled':'')+' onclick="window._loadPage(\\''+key+'\\','+(page-1)+')">Prev</button><span>Page '+(page+1)+'</span><button '+(!hasNext?'disabled':'')+' onclick="window._loadPage(\\''+key+'\\','+(page+1)+')">Next</button>';
      };
      window._loadPage = (k, p) => { const fns = { rounds: loadRounds, bets: loadBets, players: loadPlayers, merchants: loadMerchants, transfers: loadTransfers, transactions: loadTransactions }; fns[k]?.(p); };

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

      // Merchant selector elements
      const cfgMerchantSelect = document.getElementById('cfg-merchant-select');
      const cfgCopyGlobal = document.getElementById('cfg-copy-global');
      const cfgDeleteMerchant = document.getElementById('cfg-delete-merchant');
      let selectedMerchantId = '';

      const loadMerchantList = async () => {
        if (!cfgMerchantSelect || !token) return;
        try {
          const merchants = await apiFetch('/admin/merchants?limit=100');
          if (!merchants || !merchants.items) return;
          cfgMerchantSelect.innerHTML = '<option value="">Global (Default)</option>';
          merchants.items.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.merchantId;
            opt.textContent = m.merchantId + ' - ' + m.name;
            cfgMerchantSelect.appendChild(opt);
          });
        } catch (err) {
          console.error('Failed to load merchants:', err);
        }
      };

      const loadConfig = async (merchantId) => {
        const mid = merchantId !== undefined ? merchantId : selectedMerchantId;
        setStatus(configStatus, 'Loading...');
        const url = mid ? '/config/game?merchantId=' + encodeURIComponent(mid) : '/config/game';
        const config = await apiFetch(url);
        setConfigForm(config);
        if (cfgDeleteMerchant) cfgDeleteMerchant.style.display = mid ? 'inline-block' : 'none';
        setStatus(configStatus, mid ? 'Loaded config for ' + mid + '.' : 'Loaded global config.');
      };

      if (cfgMerchantSelect) {
        cfgMerchantSelect.addEventListener('change', (e) => {
          selectedMerchantId = e.target.value;
          loadConfig(selectedMerchantId).catch(err => setStatus(configStatus, err.message, true));
        });
      }

      if (cfgCopyGlobal) {
        cfgCopyGlobal.addEventListener('click', async () => {
          if (!selectedMerchantId) {
            alert('Please select a merchant first.');
            return;
          }
          if (!confirm('Copy global config to merchant ' + selectedMerchantId + '?')) return;
          setStatus(configStatus, 'Copying...');
          try {
            const globalCfg = await apiFetch('/config/game');
            const payload = buildConfigPayloadFromConfig(globalCfg);
            await apiFetch('/config/game?merchantId=' + encodeURIComponent(selectedMerchantId), {
              method: 'PUT',
              body: JSON.stringify(payload),
            });
            await loadConfig(selectedMerchantId);
            setStatus(configStatus, 'Copied global config to ' + selectedMerchantId + '.');
          } catch (err) {
            setStatus(configStatus, err.message || 'Copy failed', true);
          }
        });
      }

      if (cfgDeleteMerchant) {
        cfgDeleteMerchant.addEventListener('click', async () => {
          if (!selectedMerchantId) return;
          if (!confirm('Delete config for merchant ' + selectedMerchantId + '? It will fall back to global config.')) return;
          setStatus(configStatus, 'Deleting...');
          try {
            await apiFetch('/config/game/merchant/' + encodeURIComponent(selectedMerchantId), { method: 'DELETE' });
            setStatus(configStatus, 'Deleted config for ' + selectedMerchantId + '. Now showing global config.');
            await loadConfig(selectedMerchantId);
          } catch (err) {
            setStatus(configStatus, err.message || 'Delete failed', true);
          }
        });
      }

      const buildConfigPayloadFromConfig = (config) => {
        return {
          bettingDurationMs: config.bettingDurationMs,
          resultDurationMs: config.resultDurationMs,
          resultDisplayDurationMs: config.resultDisplayDurationMs,
          priceSnapshotInterval: config.priceSnapshotInterval,
          bonusSlotChanceTotal: config.bonusSlotChanceTotal,
          minBetAmount: config.minBetAmount,
          maxBetAmount: config.maxBetAmount,
          payoutMultiplierUp: config.payoutMultiplierUp,
          payoutMultiplierDown: config.payoutMultiplierDown,
          digitPayouts: config.digitPayouts,
          digitBonusRatios: config.digitBonusRatios,
        };
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
        loadMerchantList().catch(err => console.error('Failed to load merchants:', err));
        loadConfig().catch((error) =>
          setStatus(configStatus, error.message || 'Failed to load config', true),
        );
        loadRtp().catch((error) =>
          setStatus(rtpStatus, error.message || 'Failed to load RTP', true),
        );
      });

      configReload.addEventListener('click', async () => {
        try {
          await loadConfig(selectedMerchantId);
        } catch (error) {
          setStatus(configStatus, error.message || 'Failed to load config', true);
        }
      });

      configForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          setStatus(configStatus, 'Saving...');
          const payload = buildConfigPayload();
          const url = selectedMerchantId ? '/config/game?merchantId=' + encodeURIComponent(selectedMerchantId) : '/config/game';
          const res = await apiFetch(url, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          setConfigForm(res);
          setStatus(configStatus, selectedMerchantId ? 'Saved config for ' + selectedMerchantId + '. Changes apply next round.' : 'Saved global config. Changes apply next round.');
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
        loadMerchantList().catch(err => console.error('Failed to load merchants:', err));
        loadConfig().catch((error) => setStatus(configStatus, error.message || 'Failed to load config', true));
        loadRtp().catch((error) => setStatus(rtpStatus, error.message || 'Failed to load RTP', true));
      }
    </script>
  </body>
</html>`;

@Controller('admin')
export class AdminController {
  constructor(
    private readonly statsService: AdminStatsService,
    private readonly dataService: AdminDataService,
    private readonly accountsService: AdminAccountsService,
  ) {}

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

  // Game Management - Rounds
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('rounds')
  queryRounds(@Query() dto: QueryRoundsDto) {
    return this.dataService.queryRounds(dto);
  }

  // Game Management - Bets
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('bets')
  queryBets(@Query() dto: QueryBetsDto) {
    return this.dataService.queryBets(dto);
  }

  // Game Management - Price Snapshots
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('price-snapshots')
  queryPriceSnapshots(@Query() dto: QueryPriceSnapshotsDto) {
    return this.dataService.queryPriceSnapshots(dto);
  }

  // Player Management
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('players')
  queryPlayers(@Query() dto: QueryPlayersDto) {
    return this.dataService.queryPlayers(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('players/:id/status')
  updatePlayerStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePlayerStatusDto,
  ) {
    return this.dataService.updatePlayerStatus(id, dto.status);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('players/logins')
  queryPlayerLogins(@Query() dto: QueryPlayerLoginsDto) {
    return this.dataService.queryPlayerLogins(dto);
  }

  // Merchant Management
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('merchants')
  queryMerchants(@Query() dto: QueryMerchantsDto) {
    return this.dataService.queryMerchants(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('merchants')
  createMerchant(@Body() dto: CreateMerchantDto) {
    return this.dataService.createMerchant(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('merchants/:id')
  getMerchant(@Param('id') id: string) {
    return this.dataService.getMerchantById(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('merchants/:id')
  updateMerchant(@Param('id') id: string, @Body() dto: UpdateMerchantDto) {
    return this.dataService.updateMerchant(id, dto);
  }

  // Financial Management - Transfers
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('transfers')
  queryTransfers(@Query() dto: QueryTransfersDto) {
    return this.dataService.queryTransfers(dto);
  }

  // Financial Management - Wallet Transactions
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('transactions')
  queryTransactions(@Query() dto: QueryTransactionsDto) {
    return this.dataService.queryTransactions(dto);
  }

  // Admin Account Management
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('accounts')
  queryAdminAccounts(@Query() dto: QueryAdminAccountsDto) {
    return this.accountsService.queryAccounts(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('accounts')
  createAdminAccount(@Body() dto: CreateAdminAccountDto) {
    return this.accountsService.createAccount(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('accounts/:id')
  getAdminAccount(@Param('id') id: string) {
    return this.accountsService.getAccountById(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('accounts/:id')
  updateAdminAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAdminAccountDto,
  ) {
    return this.accountsService.updateAccount(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('accounts/login-records')
  queryAdminLoginRecords(@Query() dto: QueryLoginRecordsDto) {
    return this.accountsService.queryLoginRecords(dto);
  }
}
