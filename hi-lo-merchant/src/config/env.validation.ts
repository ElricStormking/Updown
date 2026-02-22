import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  MERCHANT_API_PORT: z.coerce.number().min(1).default(4003),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET should be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  INTEGRATION_TIMESTAMP_TOLERANCE_SEC: z.coerce.number().min(1).default(10),
  INTEGRATION_GAME_URL: z.string().url().default('https://game.example.com'),
  INTEGRATION_CALLBACK_TIMEOUT_MS: z.coerce.number().min(1000).default(5000),
  INTEGRATION_CALLBACK_RETRY_COUNT: z.coerce.number().min(0).max(10).default(2),
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
