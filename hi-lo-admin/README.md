# hi-lo-admin

Standalone NestJS service for admin UI and admin APIs.

## Responsibilities

- Serves admin page at `/admin`.
- Exposes `/admin/*` and `/admin/auth/*` endpoints.
- Proxies `/config/game*` requests to `hi-lo-server` (`GAME_SERVER_URL`) so admin UI works on direct `:4002/admin` access.
- Uses the shared database schema and JWT secret with `hi-lo-server`.

Schema migrations are owned by `hi-lo-server/prisma`.

## Local Run

1. Copy `environment.sample` to `environment.local` and fill values.
2. Install dependencies: `npm install`
3. Generate Prisma client from canonical schema: `npm run prisma:generate`
4. Start dev server: `npm run start:dev`

Default port is `4002`.
