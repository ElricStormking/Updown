# Docker CI/CD Deployment Plan

## Architecture Overview

This deployment uses Nginx as the single browser-facing gateway. Players and merchant-launch flows should resolve API calls, static assets, and Socket.IO traffic through the same public origin. Port `4000` remains an optional compatibility alias for legacy merchant testing; it is not the primary production browser contract.

```mermaid
graph LR
    Browser["Player / Merchant Browser"]

    subgraph host ["Customer deployment host (docker compose)"]
        Nginx["Nginx gateway\nsame-origin public entrypoint"]
        Deploy["deploy.sh / deploy.ps1"]

        subgraph services ["docker-compose.services.yml"]
            Client["hi-lo-client :3000\nstatic assets only"]
            Server["hi-lo-server :4001"]
            Admin["hi-lo-admin :4002"]
            Merchant["hi-lo-merchant :4003"]
            Migrate["migrate\nprisma migrate deploy"]
        end

        subgraph infra ["docker-compose.infra.yml"]
            PostgreSQL["PostgreSQL :5432"]
            Redis["Redis :6379"]
        end
    end

    subgraph cicd ["GitHub CI/CD"]
        GHA["GitHub Actions"]
        Registry["Docker Registry"]
    end

    Browser -->|"https://host/ or http://host/"| Nginx
    Browser -.->|"legacy http://host:4000/"| Nginx

    Nginx -->|"/"| Client
    Nginx -->|"/auth /bets /wallet /history /config /users /health /socket.io"| Server
    Nginx -->|"/admin"| Admin
    Nginx -->|"/integration"| Merchant

    Admin -->|"GAME_SERVER_URL"| Server
    Server --> PostgreSQL
    Server --> Redis
    Admin --> PostgreSQL
    Merchant --> PostgreSQL
    Migrate --> PostgreSQL

    GHA -->|"build + push images"| Registry
    Registry -->|"deployment host pulls images"| Deploy
    Deploy -->|"run once before app start"| Migrate
    Deploy -->|"start services after migrate succeeds"| Client
    Deploy -->|"start services after migrate succeeds"| Server
    Deploy -->|"start services after migrate succeeds"| Admin
    Deploy -->|"start services after migrate succeeds"| Merchant
    Deploy -->|"publish same-origin routes"| Nginx
```

### Production Browser Contract

- Primary public entrypoint: the site origin on `:80` and, when TLS is enabled, `:443`
- Compatibility alias: optional `:4000` mapped to the same gateway routes for legacy merchant integrations already configured against that port
- The browser must not assume direct access to `hi-lo-client`, `hi-lo-server`, `hi-lo-admin`, or `hi-lo-merchant` ports

### Port Mapping (Production)

| Service | Internal (Docker network) | Host-exposed | Notes |
| ------- | ------------------------- | ------------ | ----- |
| Nginx gateway | :80 | :80, optional :443, optional `:4000 -> :80` | Primary public entrypoint for browser traffic |
| hi-lo-client | :3000 | not exposed | Static asset server behind Nginx |
| hi-lo-server | :4001 | not exposed | Game API + Socket.IO |
| hi-lo-admin | :4002 | not exposed | Admin API + admin HTML |
| hi-lo-merchant | :4003 | not exposed | Merchant integration API |
| PostgreSQL | :5432 | not exposed | Internal only |
| Redis | :6379 | not exposed | Internal only |

If TLS terminates at the gateway container, expose `:443` there. If TLS terminates at an external load balancer or host-level proxy, keep Nginx on internal HTTP and forward the original host/proto headers so the browser still sees a same-origin deployment.

---

## Phase 1: Dockerfiles for Each Service

All service images build from the repo root as the Docker context so admin and merchant can copy the canonical Prisma schema from `hi-lo-server/prisma/`.

### 1a. `hi-lo-server/Dockerfile`

- **Stage 1 (builder):** `node:20-alpine`, copy `hi-lo-server/package*.json`, run `npm ci`, copy `src/` and `prisma/`, run `npx prisma generate`, run `npm run build`
- **Stage 2 (runtime):** `node:20-alpine`, copy `node_modules`, `dist/`, and `prisma/`, set `NODE_ENV=production`, `CMD ["node", "dist/main.js"]`
- Expose port `4001`

### 1b. `hi-lo-client/Dockerfile`

- **Stage 1 (builder):** `node:20-alpine`, copy `hi-lo-client/package*.json`, run `npm ci`, copy `src/`, `assets/`, `index.html`, and `vite.config.ts`
- Set production build args or env values to keep the browser same-origin:
  - `VITE_API_URL=/`
  - `VITE_WS_URL=/`
- Run `npm run build` and output to `dist/`
- **Stage 2 (runtime):** `nginx:alpine`, copy `dist/` to `/usr/share/nginx/html`, copy `hi-lo-client/nginx.conf` for SPA fallback
- Expose port `3000`
- Note: the client container is not the public entrypoint; Nginx is

### 1c. `hi-lo-admin/Dockerfile`

- **Stage 1 (builder):** `node:20-alpine`, copy `hi-lo-admin/package*.json`, run `npm ci`, copy `hi-lo-server/prisma/schema.prisma` to `hi-lo-admin/prisma/schema.prisma`, run `npx prisma generate`, copy admin source, run `npm run build`
- **Stage 2 (runtime):** `node:20-alpine`, copy `node_modules`, `dist/`, `prisma/`, and `admin-page.html`, set `NODE_ENV=production`, `CMD ["node", "dist/main.js"]`
- Expose port `4002`

### 1d. `hi-lo-merchant/Dockerfile`

- Same pattern as admin, exposing port `4003`

### 1e. `.dockerignore` (root level, shared)

- Ignore generated or local-only content such as `node_modules`, `dist`, `.env`, `.git`, and `.cursor`
- Do **not** blanket-ignore `*.png`, because the client build depends on PNG assets under `hi-lo-client/assets`
- Do **not** exclude `admin-page.html`, because the admin runtime image must copy it

---

## Phase 2: Docker Compose Files

### 2a. `docker-compose.infra.yml`

Infrastructure services with named volumes and readiness checks:

- **PostgreSQL** (`postgres:16-alpine`)
  - Named volume `pgdata`
  - Internal port `5432`
  - `POSTGRES_DB=hi_lo_game`
  - Healthcheck: `pg_isready -U postgres -d hi_lo_game`
- **Redis** (`redis:7-alpine`)
  - Named volume `redisdata`
  - Internal port `6379`
  - Healthcheck: `redis-cli ping`
- **Nginx** (gateway)
  - Bind-mount `gateway/nginx.prod.conf`
  - Publish `:80`
  - Optionally publish `:443` when TLS is terminated at the gateway
  - Optionally publish `:4000 -> :80` as a compatibility alias
  - Start only after upstream containers are healthy

### 2b. `docker-compose.services.yml`

Application services pulled from the Docker registry:

- **migrate**
  - Image: `${REGISTRY}/hi-lo-server:${TAG}`
  - Command: `npx prisma migrate deploy`
  - Env file: `.env.production`
  - Depends on PostgreSQL being healthy
- **hi-lo-server**
  - Image: `${REGISTRY}/hi-lo-server:${TAG}`
  - Env file: `.env.production`
  - Depends on PostgreSQL healthy, Redis healthy, and `migrate` completed successfully
  - Healthcheck: HTTP `GET /health`
- **hi-lo-client**
  - Image: `${REGISTRY}/hi-lo-client:${TAG}`
  - Healthcheck: HTTP `GET /`
- **hi-lo-admin**
  - Image: `${REGISTRY}/hi-lo-admin:${TAG}`
  - Env file: `.env.production`
  - Internal runtime dependency on `hi-lo-server`
  - Set `GAME_SERVER_URL=http://hi-lo-server:4001`
  - Depends on PostgreSQL healthy, `migrate` completed successfully, and `hi-lo-server` healthy
  - Healthcheck: HTTP `GET /health`
- **hi-lo-merchant**
  - Image: `${REGISTRY}/hi-lo-merchant:${TAG}`
  - Env file: `.env.production`
  - Depends on PostgreSQL healthy and `migrate` completed successfully
  - Healthcheck: HTTP `GET /health`
- All services join the shared `hi-lo-net` network so container names resolve directly in Nginx upstreams and internal service-to-service URLs

### 2c. `.env.production.example`

Use explicit production keys instead of a vague placeholder list:

```dotenv
NODE_ENV=production

REGISTRY=ghcr.io/elricstormking/updown
TAG=latest

POSTGRES_DB=hi_lo_game
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace-with-a-strong-db-password

API_PORT=4001
ADMIN_API_PORT=4002
MERCHANT_API_PORT=4003

# Keep DATABASE_URL in sync with POSTGRES_* values above.
DATABASE_URL=postgresql://postgres:replace-with-a-strong-db-password@postgres:5432/hi_lo_game?schema=public
REDIS_URL=redis://redis:6379

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1h
PASSWORD_SALT_ROUNDS=12
CACHE_TTL_SECONDS=5
ADMIN_ACCOUNTS=

FRONTEND_ORIGIN=https://game.example.com
ADMIN_UI_URL=https://game.example.com/admin
GAME_SERVER_URL=http://hi-lo-server:4001

BINANCE_WS_URL=wss://stream.binance.com:9443/ws/btcusdt@trade
BINANCE_REST_URL=https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
BINANCE_RECONNECT_DELAY=3000
BINANCE_HEARTBEAT_INTERVAL=2000

ROUND_STATE_TTL=60000
PLAYER_BET_HISTORY_LIMIT=100
ROUND_HISTORY_LIMIT=100

INTEGRATION_GAME_URL=https://game.example.com
INTEGRATION_TIMESTAMP_TOLERANCE_SEC=10
INTEGRATION_CALLBACK_TIMEOUT_MS=5000
INTEGRATION_CALLBACK_RETRY_COUNT=2
INTEGRATION_OFFLINE_GRACE_MS=30000
INTEGRATION_LAUNCH_SESSION_TTL_SEC=3600

VITE_API_URL=/
VITE_WS_URL=/
```

Do not make the production browser depend on `VITE_GATEWAY_URL=http://host:4000`. Same-origin is the default production contract.

---

## Phase 3: Nginx Gateway Config Update

Update `gateway/nginx.prod.conf` so Nginx remains the single browser-facing origin:

- Add upstream `hi_lo_client -> hi-lo-client:3000`
- Keep `hi_lo_game_server`, `hi_lo_admin_server`, and `hi_lo_merchant_server`
- Route specific API and websocket paths before the client catch-all
- Route `/` to the client container instead of `hi-lo-server`
- Keep `/socket.io/` upgrade handling on the game server
- If TLS terminates at the gateway, add a mirrored `server` block for `:443`; otherwise keep the same route set on HTTP behind the upstream TLS terminator

**Routing table:**

| Path | Upstream | Notes |
| ---- | -------- | ----- |
| `/auth/`, `/bets/`, `/wallet/`, `/history/`, `/config/`, `/users/`, `/health` | `hi-lo-server:4001` | Game server REST API |
| `/socket.io/` | `hi-lo-server:4001` | Game websocket / Socket.IO |
| `/admin`, `/admin/` | `hi-lo-admin:4002` | Admin UI + admin API |
| `/integration/launch/session/start` | `hi-lo-server:4001` | Launch verification endpoint |
| `/integration`, `/integration/` | `hi-lo-merchant:4003` | Merchant integration API |
| `/` | `hi-lo-client:3000` | Static files and SPA fallback |

Port `4000`, when exposed, must route to the exact same Nginx config as `:80`.

---

## Phase 4: Database Migration and Deployment Ordering

Prisma migration ownership belongs to the deployment host, not GitHub Actions.

### Cold-start / deploy sequence

1. `docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml pull`
2. `docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml up -d postgres redis`
3. Wait for PostgreSQL and Redis healthchecks to pass
4. `docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml rm -sf migrate`
5. `docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml up -d migrate`
6. Wait until `migrate` exits successfully
7. `docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml up -d hi-lo-server hi-lo-client hi-lo-admin hi-lo-merchant`
8. Wait for application healthchecks to pass
9. `docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml up -d nginx`

This is a **minimal-downtime restart** flow. Single-replica Docker Compose is not a true zero-downtime deployment model.

---

## Phase 5: GitHub Actions CI/CD

### 5a. `.github/workflows/ci.yml`

Triggered on push to `main` or manual dispatch:

1. Checkout repo
2. Log in to GitHub Container Registry
3. Build all four application images from the repo root:
   - `hi-lo-server`
   - `hi-lo-client`
   - `hi-lo-admin`
   - `hi-lo-merchant`
4. Tag images as `ghcr.io/<owner>/updown/hi-lo-<service>:${GITHUB_SHA}` and `:latest`
5. Push images to GitHub Container Registry

GitHub Actions must **not** connect to customer PostgreSQL or run `prisma migrate deploy` against production infrastructure.

### 5b. Deploy step (SSH or manual)

The production host pulls images, runs the one-shot `migrate` container, then starts application services and finally Nginx.

### 5c. Manual deployment on a single server

Use this runbook when the customer has one server and deployment is performed directly on that machine without a separate CD agent.

#### Prerequisites

- Docker Engine and Docker Compose plugin installed on the server
- Firewall or security group allows inbound `80`, and optionally `443` and `4000` if those listeners are enabled
- DNS for the public hostname points to this machine
- The deployment artifacts from this plan already exist:
  - `docker-compose.infra.yml`
  - `docker-compose.services.yml`
  - `.env.production`
  - `gateway/nginx.prod.conf`

#### Prepare the deployment directory

Create one deployment folder on the server and keep all runtime files there. Example structure:

```text
<deploy-dir>/
  docker-compose.infra.yml
  docker-compose.services.yml
  .env.production
  gateway/
    nginx.prod.conf
```

Suggested locations:

- Linux: `/opt/projectupdown`
- Windows: `C:\\ProjectUpDownDeploy`

Copy the compose files, `.env.production`, and `gateway/nginx.prod.conf` into that directory before starting the stack.

#### First-time deployment steps

Run the following from the deployment directory on the target server:

```bash
docker login <your-registry>
docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml pull
docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml up -d postgres redis
docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml rm -sf migrate
docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml up -d migrate
docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml up -d hi-lo-server hi-lo-client hi-lo-admin hi-lo-merchant
docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml up -d nginx
docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml ps
```

Operational notes:

- Wait for PostgreSQL and Redis healthchecks to pass before running `migrate`
- Wait until the `migrate` container exits with code `0` before starting the app services
- Wait for application healthchecks to pass before starting or reloading Nginx
- If HTTPS terminates at this server, place certificates where `gateway/nginx.prod.conf` expects them before starting the gateway

#### Post-deploy validation

After the stack is up, verify:

- `docker compose -f docker-compose.infra.yml -f docker-compose.services.yml ps` shows all services healthy or running
- `http://<host>/` serves the player client
- `http://<host>/health` returns the game server health response through Nginx
- `http://<host>/admin` serves the admin page
- Optional compatibility check: `http://<host>:4000/` resolves to the same gateway routes when the alias is enabled

#### Updating to a newer image tag

For a manual update on the same server:

1. Change `TAG` in `.env.production` to the new release tag
2. Run `docker compose --env-file .env.production -f docker-compose.infra.yml -f docker-compose.services.yml pull`
3. Re-run the same start order:
   - infra
   - remove and re-run `migrate`
   - app services
   - Nginx

#### Rollback

If the new release must be rolled back:

1. Set `TAG` in `.env.production` back to the previous known-good image tag
2. Pull that tag from the registry
3. Re-run the same deployment order
4. Only roll back application images after confirming the database schema remains compatible with the older version

---

## Phase 6: Cross-Platform Considerations

The deployment host may run Docker on Linux or Windows. The containers remain Linux-based in both cases.

- Add `.gitattributes` entries that enforce LF for `Dockerfile*`, `*.sh`, `*.conf`, `*.yml`, and `*.yaml`
- Provide both `deploy.sh` and `deploy.ps1`
- Use named volumes for PostgreSQL and Redis data
- Keep build-time client env vars (`VITE_API_URL=/`, `VITE_WS_URL=/`) OS-agnostic

---

## Validation Checklist

- The markdown diagram, routing table, env template, and deployment steps all describe the same startup flow
- Opening `https://host/` keeps REST and Socket.IO traffic same-origin
- Opening legacy `http://host:4000/` reaches the same gateway routes when the compatibility alias is enabled
- PostgreSQL becomes healthy before `migrate` runs, and `migrate` completes before app services start
- `hi-lo-admin` includes `admin-page.html` in the runtime image and uses `GAME_SERVER_URL=http://hi-lo-server:4001`
- The CI/CD diagram does not imply any CI-to-production-database connection

---

## Files to Create

| File | Purpose |
| ---- | ------- |
| `hi-lo-server/Dockerfile` | Server image (NestJS + Prisma) |
| `hi-lo-client/Dockerfile` | Client image (Vite build + nginx) |
| `hi-lo-client/nginx.conf` | Client container nginx config |
| `hi-lo-admin/Dockerfile` | Admin image (NestJS + Prisma + admin HTML) |
| `hi-lo-merchant/Dockerfile` | Merchant image (NestJS + Prisma) |
| `.dockerignore` | Shared Docker ignore |
| `.gitattributes` | Enforce LF for Docker/script/config files |
| `docker-compose.infra.yml` | PostgreSQL, Redis, Nginx, healthchecks |
| `docker-compose.services.yml` | App services + migrate job |
| `.env.production.example` | Explicit production env template |
| `.github/workflows/ci.yml` | Build and push workflow |
| `deploy.sh` | Linux deployment helper |
| `deploy.ps1` | Windows deployment helper |

## Files to Modify

| File | Change |
| ---- | ------ |
| `gateway/nginx.prod.conf` | Add client upstream, keep API routing explicit, and mirror the same route set for any optional TLS / compatibility listeners |
| `CI_CD_setup_Graph.png` | Update the standalone diagram to match the corrected same-origin deployment and migration ownership flow |
