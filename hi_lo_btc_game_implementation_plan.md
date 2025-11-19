# Hi-Lo Bitcoin Prediction Game — Implementation Plan
**Tech Stack: Phaser 3 + NestJS + Prisma + Postgres (Supabase hosted)**  
**Game Cycle: 25-second rounds (15s Betting + 10s Result Phase)**  
**External Data Source: Binance Live BTC/USDT Price**  

Target coding tools/environment: **Cursor AI**, **Supabase MCP**, and **ChatGPT-5 Codex** for implementation assistance.

---

## 1. Overview

This project is an **online casino hi-lo prediction game** using the **live Bitcoin price** from Binance.  
Players predict whether BTC price will go **UP** or **DOWN** after each round.

**Round cycle (25 seconds total):**

| Phase | Duration | Description |
|-------|----------|-------------|
| **Betting Phase** | **15 sec** | Players place UP/DOWN bets. Price is “locked” at the end of this phase. |
| **Result Phase** | **10 sec** | BTC price continues updating. At the end, game decides WIN/LOSE. |
| **Round Restarts** | immediately | Next round begins automatically. |

Game UI displays:

- Live Bitcoin price  
- Countdown timers  
- Locked price  
- Final result price  
- Odds for UP/DOWN  
- Result animations  
- Betting controls  
- Past rounds / history summary  

Backend records all bets and provides history for analysis, including a **summary of the last 100 bets** per player for decision making.

---

## 2. System Architecture Summary

### 2.1 Frontend — Phaser 3

Responsibilities:

- Show real-time Bitcoin price feed.
- Render round timer and game states (Betting, Locked, Result).
- Allow user to:
  - Choose UP/DOWN.
  - Set bet amount.
  - Confirm/cancel bet (within allowed window).
- Display:
  - Locked price.
  - Final price and outcome.
  - Player balance / win-lose animations.
  - History view for the last 100 bets (player level) and last X rounds (global).
- Communication:
  - **REST** for login, fetching history, and config.
  - **WebSocket** for live events (prices, round states, results).

Implementation hints (for Cursor):

- Use a main Phaser Scene for the game stage.
- Separate UI elements into reusable containers (bet panel, price panel, timer, history).
- Consider a small UI state machine mirroring backend round state.

---

### 2.2 Backend — NestJS (Node.js)

Core responsibilities:

- Maintain a **global round scheduler**:
  - 25-second fixed rounds.
  - 15 seconds for betting, 10 seconds for result.
- Manage communication with **Binance WebSocket** price feed.
- Expose **WebSocket gateway** for the Phaser client.
- Provide **REST endpoints** for basic operations:
  - Auth (login/register or token verification, depending on auth design).
  - Fetch player history.
  - Fetch global history summary.
- Perform **bet validation & settlement**:
  - Validate bet amount, balance, and phase.
  - Lock price at betting end.
  - Compute result at round end.
  - Update balances and bet records transactionally via Prisma.

Suggested NestJS modules:

- `AppModule`
- `AuthModule`
- `UserModule`
- `WalletModule`
- `GameModule` (round logic + WebSocket gateway)
- `BetModule`
- `HistoryModule`
- `BinanceModule` (price service)
- `RedisModule` (for caching and pub/sub)

Each module should have its own controller (if REST is needed), service, and (optionally) gateway/providers.

---

### 2.3 Database — Prisma + Postgres (Supabase Hosted First)

Use **Prisma** as ORM and generate the client for NestJS.

Early stage:

- Use **Supabase hosted Postgres** for fast development.
- Connect via `DATABASE_URL` (provided by Supabase).
- Migrate schema with `prisma migrate dev` and `prisma migrate deploy`.

Future stage:

- For compliance / private infra:
  1. Move Postgres to a private/self-hosted setup.
  2. Keep Prisma + NestJS code unchanged.
  3. Only update `DATABASE_URL` in environment variables.

Core tables (Prisma models):

- `User`
- `Wallet`
- `Round`
- `Bet`
- `PriceSnapshot` (optional for charts/analytics)

See section **4. Database Schema (Prisma)** below.

---

### 2.4 Redis — Caching and Pub/Sub

Use Redis for:

- Caching the latest BTC price (`currentPrice`).
- Caching current round state (round ID, start/lock/end timestamps).
- Optional:
  - Pub/sub if running multiple NestJS instances.
  - Rate limiting per IP/user.

---

### 2.5 Nginx — Reverse Proxy (Production)

Responsibilities:

- Terminate HTTPS (Let’s Encrypt or other certs).
- Route traffic:
  - `/api` → NestJS HTTP port.
  - `/ws` → NestJS WebSocket gateway.
- Provide basic security headers and CORS restrictions.

Nginx is introduced and tuned **after core backend and game loop work reliably**.

---

### 2.6 Docker — Late Stage Only

Docker will be used **only after** the following are working well:

- Supabase (Postgres)
- NestJS backend
- Prisma migrations
- Redis caching
- Nginx config

Then:

- Create Docker images for:
  - `api` (NestJS backend)
  - `price-service` (Binance listener if separated)
  - `redis` (if self-hosted in the future)
  - `nginx` (reverse proxy)
- Use `docker-compose` or another orchestrator for deployment.

---

## 3. Round Logic Specification

### 3.1 Timings

- **Total round duration:** 25 seconds.
  - **Betting Phase:** first 15 seconds.
  - **Result Phase:** next 10 seconds.

### 3.2 Phase Details

#### Betting Phase (0–15s)

Backend:

- Sets round state to `BETTING`.
- Broadcasts:
  - `round:start` event with:
    - roundId
    - startTime
    - lockTime
    - odds for UP/DOWN
- Accepts bet messages:
  - Validates:
    - Round is in `BETTING` state.
    - User has enough balance.
    - Bet amount within min/max.
  - Uses Prisma transaction to create `Bet` + adjust `Wallet` balance.
- Continuously broadcasts live BTC price.

At `t = 15s`:

- Stop accepting new bets.
- Record `lockedPrice` from Redis (or Binance feed snapshot).
- Set round state to `LOCKED` or `RESULT_PENDING`.
- Emit `round:locked` event to clients with the locked price.

#### Result Phase (15–25s)

Backend:

- Round state is `RESULT_PENDING`.
- Continue to receive BTC price from Binance; keep updating `currentPrice` in Redis.
- At `t = 25s`:
  - Read `finalPrice`.
  - Determine `winningSide`:
    - `UP` if `finalPrice > lockedPrice`.
    - `DOWN` if `finalPrice < lockedPrice`.
    - `PUSH/REFUND` if equal (house rule).

Settlement step (transactional):

- For each bet in this round:
  - If bet side equals `winningSide`:
    - Compute payout (based on odds or fixed multiplier).
    - Update wallet balance (`balance += payout`).
    - Mark bet result as `WIN` and store `payout`.
  - Else:
    - Mark bet result as `LOSE` and `payout = 0`.
- Update `Round` record with:
  - `lockedPrice`
  - `finalPrice`
  - `winningSide`
  - `status = COMPLETED`

Broadcast:

- Emit `round:result` with:
  - roundId
  - lockedPrice
  - finalPrice
  - winningSide
  - global stats if needed (total UP/DOWN bets, etc.).
- Emit `balance:update` events for each player (via user-specific channels).

Then immediately create and start the next round.

---

## 4. Database Schema (Prisma Draft)

This is a high-level design; actual Prisma schema can be refined.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // or external auth identifier
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  wallet    Wallet?
  bets      Bet[]
}

model Wallet {
  id        String   @id @default(cuid())
  userId    String   @unique
  balance   Decimal  @default(0)
  currency  String   @default("USDT")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id])
}

model Round {
  id           Int       @id @default(autoincrement())
  startTime    DateTime
  lockTime     DateTime
  endTime      DateTime
  lockedPrice  Decimal?
  finalPrice   Decimal?
  winningSide  BetSide?
  status       RoundStatus @default(PENDING)
  createdAt    DateTime    @default(now())

  bets         Bet[]
}

model Bet {
  id        String    @id @default(cuid())
  userId    String
  roundId   Int
  side      BetSide
  amount    Decimal
  payout    Decimal   @default(0)
  result    BetResult @default(PENDING)
  createdAt DateTime  @default(now())

  user      User      @relation(fields: [userId], references: [id])
  round     Round     @relation(fields: [roundId], references: [id])
}

model PriceSnapshot {
  id        String   @id @default(cuid())
  timestamp DateTime @default(now())
  price     Decimal
  source    String   @default("BINANCE")
  roundId   Int?
  round     Round?   @relation(fields: [roundId], references: [id])
}

enum BetSide {
  UP
  DOWN
}

enum BetResult {
  PENDING
  WIN
  LOSE
  REFUND
}

enum RoundStatus {
  PENDING
  BETTING
  RESULT_PENDING
  COMPLETED
}
```

---

## 5. Backend API & WebSocket Design

### 5.1 REST Endpoints (HTTP)

- `POST /auth/register`
- `POST /auth/login`
- `GET  /user/me`
- `GET  /user/wallet`
- `GET  /history/bets?limit=100`
- `GET  /history/rounds?limit=100`
- `GET  /config/game` (e.g., odds, min/max bet)

These endpoints integrate naturally with Cursor AI and Supabase MCP for codegen and schema syncing.

### 5.2 WebSocket Events

**Server → Client:**

- `price:update`
  - `{ price, timestamp }`
- `round:start`
  - `{ roundId, startTime, lockTime, endTime, oddsUp, oddsDown }`
- `round:locked`
  - `{ roundId, lockedPrice }`
- `round:result`
  - `{ roundId, lockedPrice, finalPrice, winningSide }`
- `balance:update`
  - `{ balance }`
- `history:update` (optional push)

**Client → Server:**

- `bet:place`
  - `{ roundId, side, amount }`
- `client:ready`
  - `{ userId or token }`
- `client:requestHistory`
  - `{ limit }`

NestJS Gateway (with Socket.IO or ws) will handle authentication, rooms, and broadcasting.

---

## 6. Binance Integration

### 6.1 Price Service (BinanceModule)

- Use Binance WebSocket endpoint for `btcusdt` trades or ticker.
- On each message:
  - Parse price.
  - Update Redis key `btc:currentPrice`.
  - Optionally broadcast `price:update` to WebSocket gateway.

**Responsibilities:**

- Connection management (auto reconnect).
- Basic rate limiting / error handling.
- Optional `PriceSnapshot` insertion every N seconds for charting.

---

## 7. History & Analytics

### 7.1 Player History

- `GET /history/bets?limit=100` returns:
  - Last 100 bets for the authenticated user.
  - Each entry:
    - Round ID
    - Bet side
    - Amount
    - Result (WIN/LOSE/REFUND)
    - Payout
    - Locked & final prices

### 7.2 Global History

- `GET /history/rounds?limit=100` returns:
  - Last N rounds with:
    - winningSide
    - lockedPrice
    - finalPrice
    - timestamps

### 7.3 On-Client Analytics

Phaser client can:

- Render streaks (UP/DOWN).
- Show win/loss distribution.
- Provide visualization similar to the reference screenshots.

Cursor AI can be used to generate charts & UI logic based on this data.

---

## 8. Development Phases

### Phase 1 — Core Setup

- Initialize **Supabase** project (Postgres).
- Initialize **NestJS** project structure.
- Set up **Prisma** with `DATABASE_URL` from Supabase.
- Implement `User`, `Wallet`, `Round`, `Bet` models.
- Basic auth (email/password or token-based).

### Phase 2 — Game Loop & WebSocket

- Implement **Binance price service**.
- Implement **round scheduler** (25-second cycles).
- Implement **WebSocket Gateway** and basic events.
- Implement bet placement & validation.
- Implement round locking & settlement logic.

### Phase 3 — Phaser 3 Frontend

- Basic UI layout for:
  - Live price.
  - UP/DOWN buttons.
  - Timer.
  - Bet input.
- Integrate WebSocket & REST.
- Show per-round results & simple animations.

### Phase 4 — History & Analytics

- Implement history endpoints.
- Prisma queries for last 100 bets / rounds.
- Phaser UI for history views and summary.

### Phase 5 — Redis & Nginx Integration

- Add Redis module for caching & pub/sub.
- Add Nginx as reverse proxy in front of NestJS.
- Configure HTTPS, security headers, rate limiting.

### Phase 6 — Dockerization (Late Stage)

- Create Dockerfiles for:
  - NestJS API
  - (Optional) separate Binance price service
  - Nginx
  - Redis (if self-hosted later)
- Create `docker-compose.yml` for production-like environment.

---

## 9. Future Compliance / Private Hosting Strategy

When moving towards regulated / private infra:

1. Provision private Postgres instance (self-hosted or managed in private VPC).
2. Migrate data from Supabase Postgres to the new instance.
3. Update `DATABASE_URL` for Prisma & NestJS.
4. Host NestJS, Redis, and Nginx inside same private network.
5. Add detailed logging, monitoring, and backup policies.
6. Optionally introduce Kubernetes or ECS for orchestrating Docker containers.

Because the stack is **NestJS + Prisma + Postgres**, the codebase remains largely unchanged—only infrastructure and connection details evolve.

---

## 10. Tooling Notes (Cursor AI, Supabase MCP, ChatGPT-5 Codex)

- Use **Cursor AI**:
  - To generate NestJS modules, services, DTOs, and WebSocket gateways.
  - To auto-refactor repetitive game loop or round-processing code.
- Use **Supabase MCP**:
  - To manage database schema alongside Prisma (if desired).
  - To inspect and seed data from your editor.
- Use **ChatGPT-5 Codex**:
  - For complex logic (round scheduler, settlement rules).
  - For Prisma query optimization & type-safe patterns.
  - For Phaser 3 rendering and UI state machine design.

Keep this file in the repo root (e.g., `IMPLEMENTATION_PLAN.md`) so all tools and collaborators share the same technical blueprint.
