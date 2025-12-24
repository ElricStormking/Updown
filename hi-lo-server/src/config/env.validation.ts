import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().min(1).default(4000),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET should be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  PASSWORD_SALT_ROUNDS: z.coerce.number().min(4).default(12),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  CACHE_TTL_SECONDS: z.coerce.number().min(1).default(5),
  BINANCE_WS_URL: z.string().url(),
  BINANCE_REST_URL: z.string().url(),
  BINANCE_RECONNECT_DELAY: z.coerce.number().min(500).default(3000),
  BINANCE_HEARTBEAT_INTERVAL: z.coerce.number().min(250).default(2000),
  ROUND_STATE_TTL: z.coerce.number().min(5000).default(60000),
  PLAYER_BET_HISTORY_LIMIT: z.coerce.number().min(1).max(1000).default(100),
  ROUND_HISTORY_LIMIT: z.coerce.number().min(1).max(1000).default(100),
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
