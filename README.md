# Updown

## Project structure

- `hi-lo-client`: player UI
- `hi-lo-admin`: standalone admin service (`/admin`, `/admin/*`, `/admin/auth/*`)
- `hi-lo-merchant`: standalone merchant integration service (`/integration/*`)
- `hi-lo-server`: gameplay runtime service (`/auth/*`, `/wallet/*`, `/bets/*`, `/history/*`, `/config/*`, websocket)
- `gateway`: reverse proxy config/scripts that keep public routes stable

## Local split run

1. Install service dependencies:
   - `npm run install:all`
2. Start all services + gateway:
   - `npm run start:all`

Default ports:

- Gateway: `4000`
- `hi-lo-server`: `4001`
- `hi-lo-admin`: `4002`
- `hi-lo-merchant`: `4003`

## Prisma schema ownership

- Canonical schema and migrations live in `hi-lo-server/prisma`.
- `hi-lo-admin` and `hi-lo-merchant` use `npm run prisma:generate` to sync `prisma/schema.prisma` from the canonical schema before generating local Prisma client.
