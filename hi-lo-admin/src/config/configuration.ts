export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  api: {
    port: Number(process.env.ADMIN_API_PORT ?? 4002),
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
  routing: {
    gameServerUrl: process.env.GAME_SERVER_URL ?? 'http://localhost:4001',
  },
});

export type AppConfig = ReturnType<typeof configuration>;
