import { gameConfig } from './game-config';

export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  api: {
    port: Number(process.env.API_PORT ?? 4000),
  },
  frontend: {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    saltRounds: Number(process.env.PASSWORD_SALT_ROUNDS ?? 12),
  },
  admin: {
    accounts: (process.env.ADMIN_ACCOUNTS ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    ttlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 5),
  },
  binance: {
    wsUrl:
      process.env.BINANCE_WS_URL ??
      'wss://stream.binance.com:9443/ws/btcusdt@trade',
    restUrl:
      process.env.BINANCE_REST_URL ??
      'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
    reconnectDelayMs: Number(process.env.BINANCE_RECONNECT_DELAY ?? 3000),
    heartbeatIntervalMs: Number(process.env.BINANCE_HEARTBEAT_INTERVAL ?? 2000),
  },
  game: gameConfig,
  roundState: {
    ttlMs: Number(process.env.ROUND_STATE_TTL ?? 60000),
  },
  history: {
    playerLimit: Number(process.env.PLAYER_BET_HISTORY_LIMIT ?? 100),
    roundLimit: Number(process.env.ROUND_HISTORY_LIMIT ?? 100),
  },
  integration: {
    timestampToleranceSec: Number(
      process.env.INTEGRATION_TIMESTAMP_TOLERANCE_SEC ?? 10,
    ),
    gameUrl: process.env.INTEGRATION_GAME_URL ?? 'https://game.example.com',
    callbackTimeoutMs: Number(
      process.env.INTEGRATION_CALLBACK_TIMEOUT_MS ?? 5000,
    ),
    callbackRetryCount: Number(
      process.env.INTEGRATION_CALLBACK_RETRY_COUNT ?? 2,
    ),
    offlineGraceMs: Number(process.env.INTEGRATION_OFFLINE_GRACE_MS ?? 30000),
    launchSessionTtlSec: Number(
      process.env.INTEGRATION_LAUNCH_SESSION_TTL_SEC ?? 3600,
    ),
  },
});

export type AppConfig = ReturnType<typeof configuration>;
