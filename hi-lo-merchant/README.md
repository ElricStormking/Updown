# hi-lo-merchant

Standalone NestJS service for merchant-facing integration APIs.

## Responsibilities

- Exposes `/integration/*` APIs for merchant systems.
- Handles launch callback preflight `/integration/launch/session/start`.
- Uses the shared database schema and JWT secret with `hi-lo-server`.

Schema migrations are owned by `hi-lo-server/prisma`.

## Local Run

1. Copy `environment.sample` to `environment.local` and fill values.
2. Install dependencies: `npm install`
3. Generate Prisma client from canonical schema: `npm run prisma:generate`
4. Start dev server: `npm run start:dev`

Default port is `4003`.
