export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  api: {
    port: Number(process.env.API_PORT ?? 4000),
  },
  frontend: {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    saltRounds: Number(process.env.PASSWORD_SALT_ROUNDS ?? 12),
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
  game: {
    bettingDurationMs: Number(process.env.ROUND_BETTING_DURATION ?? 15000),
    resultDurationMs: Number(process.env.ROUND_RESULT_DURATION ?? 10000),
    minBetAmount: Number(process.env.MIN_BET_AMOUNT ?? 1),
    maxBetAmount: Number(process.env.MAX_BET_AMOUNT ?? 1000),
    payoutMultiplierUp: Number(process.env.PAYOUT_MULTIPLIER_UP ?? 1.95),
    payoutMultiplierDown: Number(process.env.PAYOUT_MULTIPLIER_DOWN ?? 1.95),
    priceSnapshotInterval: Number(process.env.PRICE_SNAPSHOT_INTERVAL ?? 5000),
  },
  roundState: {
    ttlMs: Number(process.env.ROUND_STATE_TTL ?? 60000),
  },
  history: {
    playerLimit: Number(process.env.PLAYER_BET_HISTORY_LIMIT ?? 100),
    roundLimit: Number(process.env.ROUND_HISTORY_LIMIT ?? 100),
  },
});

export type AppConfig = ReturnType<typeof configuration>;
