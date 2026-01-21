# Hi-Lo Server

Backend for the Hi-Lo Bitcoin Prediction prototype. The service consumes the Binance BTC/USDT feed, orchestrates 25-second rounds, and exposes REST + WebSocket APIs consumed by the Phaser client.

## Stack

- NestJS 11 + TypeScript
- Prisma ORM targeting Supabase Postgres
- Redis (cache + round state)
- Binance WebSocket stream for live ticks
- Socket.IO for client transport

## Prerequisites

- Node.js 22+
- npm 10+
- Running Postgres database (Supabase recommended)
- Redis instance (Upstash/Supabase extension/local)
- Supabase MCP enabled in Cursor for schema-aware editing (connect it to the same `DATABASE_URL`)

## Environment Setup

1. `cd hi-lo-server`
2. `npm install`
3. `cp environment.sample environment.local`
4. Fill `environment.local` **and** (optionally) a `.env` file with your Supabase + Redis credentials. The ConfigModule loads both so you can keep Cursor/CI secrets in `.env` while committing only `environment.sample`.
5. Export `DATABASE_URL` so `prisma` CLI works (or pass `--schema` flags when running commands).

`environment.sample` documents every variable. Critical keys:

| Key | Description | Example |
| --- | --- | --- |
| `API_PORT` | Nest API port (avoid 3000 if client runs on 3000) | `4001` |
| `FRONTEND_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `DATABASE_URL` | Supabase Postgres URI | `postgresql://...` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6380` |
| `BINANCE_WS_URL` | BTC price stream | `wss://stream.binance.com:9443/ws/btcusdt@trade` |
| `SEED_USER_ACCOUNT` | Seed user login | `demo_account` |
| `SEED_USER_PASSWORD` | Seed user password | `changeme` |
| `SEED_USER_BALANCE` | Seed wallet balance | `1000` |
| `ADMIN_ACCOUNTS` | Comma-separated admin accounts for `/config/game` | `designer1,designer2` |
| `PLAYER_BET_HISTORY_LIMIT` | Bets returned from `/history/bets` | `100` |
| `ROUND_HISTORY_LIMIT` | Rounds returned from `/history/rounds` | `100` |
| `BINANCE_RECONNECT_DELAY` | WS reconnect backoff (ms) | `3000` |
| `BINANCE_HEARTBEAT_INTERVAL` | Price heartbeat guard (ms) | `2000` |
| `ROUND_STATE_TTL` | Round cache TTL in Redis (ms) | `60000` |

Game tuning (round timing, bet limits, payouts, snapshots) is stored in the database via `PUT /config/game` (admin-only). Defaults live in `hi-lo-server/src/config/game-config.ts`.

> Tip: store Supabase service role + anon keys as secrets in Cursor’s Supabase MCP so DTO/codegen stays schema-aware.

### Supabase MCP wiring

1. In Cursor, add a Supabase MCP connection using your project URL + service role key.
2. Point MCP to the same `DATABASE_URL` used by Prisma so migrations + generated types stay in sync.
3. Run `npm run prisma:migrate` after each schema change, then refresh the MCP schema introspection.
4. Use MCP’s auth helpers (or the provided `/auth/*` endpoints) to seed demo users without leaving the editor.

## Scripts

```bash
npm run start:dev    # watch mode
npm run start        # single run
npm run lint         # eslint + prettier
npm run test         # unit tests
npm run test:e2e     # e2e
npm run prisma:migrate -- --name init   # create + apply migration
npm run prisma:deploy                   # run migrations in CI/prod
npm run db:seed                         # seed demo wallet/user
```

> Prisma CLI needs `DATABASE_URL` exported (or defined in `environment.local`) to run migrate/seed commands.

## Ports

- API (Nest): configurable via `API_PORT` (default 4001)
- Web client (Phaser): serve via a separate process on port 3000
- Admin UI: `http://localhost:4001/admin` (or `http://localhost:3000/admin` via Vite proxy)

## Manual QA script

1. **Backend** – `npm run start:dev` (ensure Redis + Postgres/Supabase are running). Watch for `Binance WS connected` in logs.
2. **Database sanity** – `npm run prisma:migrate && npm run db:seed` to make sure the schema matches Supabase and a demo wallet exists.
3. **Client** – from `../hi-lo-client`, run `npm run dev -- --host`. Browse to `http://localhost:3000`.
4. **Login** – use the seeded credentials (`demo@hi-lo.dev / changeme`). Confirm `/wallet` + `/history` populate in the side panel.
5. **Betting loop** – wait for the round timer to reach <15s, place both `UP`/`DOWN` bets, and watch for `bet:placed` + `balance:update` socket events.
6. **Result verification** – when the round resolves, check that balances settle, `/history/bets` includes the payout, and the Phaser scene flashes green/red based on `winningSide`.

Document any anomalies (e.g., Binance disconnects) in the console output—`RoundEngineService` will automatically resume using the Redis-cached round snapshot.
