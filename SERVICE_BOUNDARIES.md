# Service Boundaries

This repository now runs three independent backend services against one shared database schema.

## Ownership

- `hi-lo-server`
  - gameplay runtime, rounds, websocket gateway, player auth/wallet/history
  - `/auth/*`, `/wallet/*`, `/bets/*`, `/history/*`, `/config/*`, `/game/*`
  - launch-session online/offline runtime orchestration and `UpdateBalance` callback trigger
- `hi-lo-admin`
  - admin UI + admin APIs
  - `/admin`, `/admin/*`, `/admin/auth/*`
- `hi-lo-merchant`
  - merchant integration APIs
  - `/integration/*`, `/integration/launch/session/start`

## Shared contracts

- Shared JWT secret across all services.
- Shared Prisma schema/migrations remain canonical in `hi-lo-server/prisma`.
- `hi-lo-admin` and `hi-lo-merchant` run `npm run prisma:generate`, which first syncs `prisma/schema.prisma` from `hi-lo-server/prisma/schema.prisma`.
- Migration ownership: one pipeline applies DB migrations before service rollout.

## Gateway routing (required)

- `/admin` and `/admin/*` -> `hi-lo-admin`
- `/integration/*` -> `hi-lo-merchant`
- all other API routes -> `hi-lo-server`
