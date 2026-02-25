export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  api: {
    port: Number(process.env.MERCHANT_API_PORT ?? 4003),
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
