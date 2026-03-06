# hi-lo-merchant

Standalone NestJS service for merchant-facing integration APIs.

## Responsibilities

- Exposes `/integration/*` APIs for merchant systems.
- Issues callback-backed launch URLs through `POST /integration/launch`.
- Uses the shared database schema and JWT secret with `hi-lo-server`.

Launch-session preflight for players is served by `hi-lo-server`, not this service.

Schema migrations are owned by `hi-lo-server/prisma`.

## Local Run

1. Copy `environment.sample` to `environment.local` and fill values.
2. Install dependencies: `npm install`
3. Generate Prisma client from canonical schema: `npm run prisma:generate`
4. Start dev server: `npm run start:dev`

Default port is `4003`.
