export interface AppConfiguration {
  env: string;
  port: number;
  corsOrigin: string[];
  databaseUrl: string;
  auth: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
    loginMaxAttempts: number;
    loginWindowMinutes: number;
  };
  business: {
    certExpiringDays: number;
    timezone: string;
  };
  news: {
    syncEnabled: boolean;
    syncIntervalMinutes: number;
    fetchTimeoutMs: number;
    maxItemsPerSource: number;
  };
  seed: {
    enabled: boolean;
  };
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

export default (): AppConfiguration => {
  const env = process.env;
  const isProduction = (env.NODE_ENV ?? 'development') === 'production';

  const corsOrigin = (env.CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    env: env.NODE_ENV ?? 'development',
    port: toInt(env.API_PORT, 4000),
    // Lista vazia (ex.: CORS_ORIGIN="") cai no padrao em vez de bloquear tudo.
    corsOrigin: corsOrigin.length > 0 ? corsOrigin : [DEFAULT_CORS_ORIGIN],
    databaseUrl: env.DATABASE_URL ?? '',
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET ?? '',
      refreshSecret: env.JWT_REFRESH_SECRET ?? '',
      accessTtl: env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: env.JWT_REFRESH_TTL ?? '7d',
      loginMaxAttempts: toInt(
        env.AUTH_LOGIN_MAX_ATTEMPTS,
        isProduction ? 5 : 10,
      ),
      loginWindowMinutes: toInt(env.AUTH_LOGIN_WINDOW_MINUTES, 15),
    },
    business: {
      certExpiringDays: toInt(env.CERT_EXPIRING_DAYS, 90),
      timezone: env.BUSINESS_TIMEZONE ?? 'America/Sao_Paulo',
    },
    news: {
      // Ingestao de feeds e' opt-in: ligada por env para nao gerar trafego
      // de saida (nem depender de internet) em ambientes controlados.
      syncEnabled: env.NEWS_SYNC_ENABLED === 'true',
      syncIntervalMinutes: toInt(env.NEWS_SYNC_INTERVAL_MINUTES, 360),
      fetchTimeoutMs: toInt(env.NEWS_FETCH_TIMEOUT_MS, 10000),
      maxItemsPerSource: toInt(env.NEWS_MAX_ITEMS_PER_SOURCE, 30),
    },
    seed: {
      enabled: env.SEED_DEMO === 'true',
    },
  };
};
