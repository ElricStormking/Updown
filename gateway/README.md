# Gateway Routing

The gateway keeps existing public paths stable while routing to split services.

## Dev proxy

Run:

```bash
npm run start:gateway
```

Default routes:

- `/admin` and `/admin/*` -> `http://localhost:4002` (`hi-lo-admin`)
- `/integration/*` -> `http://localhost:4003` (`hi-lo-merchant`)
- all other paths -> `http://localhost:4001` (`hi-lo-server`)

WebSocket upgrades are supported (socket.io traffic routes to game server by default).

## Env variables

- `GATEWAY_PORT` (default `4000`)
- `GAME_SERVER_URL` (default `http://localhost:4001`)
- `ADMIN_SERVER_URL` (default `http://localhost:4002`)
- `MERCHANT_SERVER_URL` (default `http://localhost:4003`)

## Production template

Use `gateway/nginx.prod.conf` as the baseline reverse-proxy configuration.

