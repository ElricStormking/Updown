import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().min(1).default(4000),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET should be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  PASSWORD_SALT_ROUNDS: z.coerce.number().min(4).default(12),
  ADMIN_ACCOUNTS: z.string().default(''),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  CACHE_TTL_SECONDS: z.coerce.number().min(1).default(5),
  BINANCE_WS_URL: z.string().url(),
  BINANCE_REST_URL: z.string().url(),
  BINANCE_RECONNECT_DELAY: z.coerce.number().min(500).default(3000),
  BINANCE_HEARTBEAT_INTERVAL: z.coerce.number().min(250).default(2000),
  ROUND_STATE_TTL: z.coerce.number().min(5000).default(60000),
  PLAYER_BET_HISTORY_LIMIT: z.coerce.number().min(1).max(1000).default(100),
  ROUND_HISTORY_LIMIT: z.coerce.number().min(1).max(1000).default(100),
  INTEGRATION_TIMESTAMP_TOLERANCE_SEC: z.coerce.number().min(1).default(10),
  INTEGRATION_GAME_URL: z.string().url().default('https://game.example.com'),
  INTEGRATION_CALLBACK_TIMEOUT_MS: z.coerce.number().min(1000).default(5000),
  INTEGRATION_CALLBACK_RETRY_COUNT: z.coerce.number().min(0).max(10).default(2),
  INTEGRATION_OFFLINE_GRACE_MS: z.coerce.number().min(1000).default(30000),
  INTEGRATION_LAUNCH_SESSION_TTL_SEC: z.coerce.number().min(60).default(3600),
});

export type EnvironmentVariables = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) => {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment variables: ${formatted}`);
  }

  return parsed.data;
};
