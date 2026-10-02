/**
 * Validacao de variaveis de ambiente na inicializacao.
 * Falha rapido (fail-fast) quando algo essencial esta ausente ou invalido,
 * evitando que a aplicacao suba em estado inconsistente.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  const required = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  for (const key of required) {
    if (!config[key] || String(config[key]).trim() === '') {
      errors.push(`Variavel de ambiente obrigatoria ausente: ${key}`);
    }
  }

  const port = Number(config['API_PORT'] ?? 4000);
  if (Number.isNaN(port) || port <= 0 || port > 65535) {
    errors.push('API_PORT deve ser um numero entre 1 e 65535');
  }

  const expiringDays = Number(config['CERT_EXPIRING_DAYS'] ?? 90);
  if (Number.isNaN(expiringDays) || expiringDays < 0) {
    errors.push('CERT_EXPIRING_DAYS deve ser um numero inteiro >= 0');
  }

  const newsInterval = Number(config['NEWS_SYNC_INTERVAL_MINUTES'] ?? 360);
  if (Number.isNaN(newsInterval) || newsInterval < 5) {
    errors.push('NEWS_SYNC_INTERVAL_MINUTES deve ser um numero inteiro >= 5');
  }

  const newsTimeout = Number(config['NEWS_FETCH_TIMEOUT_MS'] ?? 10000);
  if (Number.isNaN(newsTimeout) || newsTimeout < 1000) {
    errors.push('NEWS_FETCH_TIMEOUT_MS deve ser um numero inteiro >= 1000');
  }

  const digestWindowDays = Number(config['NEWS_DIGEST_WINDOW_DAYS'] ?? 7);
  if (Number.isNaN(digestWindowDays) || digestWindowDays < 1) {
    errors.push('NEWS_DIGEST_WINDOW_DAYS deve ser um numero inteiro >= 1');
  }

  const digestMaxItems = Number(config['NEWS_DIGEST_MAX_ITEMS'] ?? 20);
  if (Number.isNaN(digestMaxItems) || digestMaxItems < 1 || digestMaxItems > 100) {
    errors.push('NEWS_DIGEST_MAX_ITEMS deve ser um numero inteiro entre 1 e 100');
  }

  const maxUploadMb = Number(config['MAX_UPLOAD_MB'] ?? 10);
  if (Number.isNaN(maxUploadMb) || maxUploadMb < 1 || maxUploadMb > 50) {
    errors.push('MAX_UPLOAD_MB deve ser um numero inteiro entre 1 e 50');
  }

  // Resumo inteligente (IA): so' valida quando explicitamente ligado.
  if (String(config['AI_ENABLED'] ?? '') === 'true') {
    const aiKey = String(config['AI_API_KEY'] ?? '');
    if (aiKey.trim() === '') {
      errors.push('AI_ENABLED=true exige a variavel AI_API_KEY');
    }
    const aiBaseUrl = String(
      config['AI_BASE_URL'] ?? 'https://api.openai.com/v1',
    );
    if (!/^https?:\/\//i.test(aiBaseUrl)) {
      errors.push('AI_BASE_URL deve comecar com http(s)://');
    }
    if (String(config['AI_MODEL'] ?? 'gpt-4o-mini').trim() === '') {
      errors.push('AI_MODEL nao pode ser vazio');
    }
    const aiTimeout = Number(config['AI_TIMEOUT_MS'] ?? 20000);
    if (Number.isNaN(aiTimeout) || aiTimeout < 1000) {
      errors.push('AI_TIMEOUT_MS deve ser um numero inteiro >= 1000');
    }
  }

  const nodeEnv = String(config['NODE_ENV'] ?? 'development');
  const accessSecret = String(config['JWT_ACCESS_SECRET'] ?? '');
  const refreshSecret = String(config['JWT_REFRESH_SECRET'] ?? '');

  // Em producao os segredos precisam ser fortes e distintos entre si.
  if (nodeEnv === 'production') {
    const minLength = 32;
    if (accessSecret.length < minLength) {
      errors.push(
        `JWT_ACCESS_SECRET deve ter ao menos ${minLength} caracteres em producao`,
      );
    }
    if (refreshSecret.length < minLength) {
      errors.push(
        `JWT_REFRESH_SECRET deve ter ao menos ${minLength} caracteres em producao`,
      );
    }
    if (accessSecret && accessSecret === refreshSecret) {
      errors.push('JWT_ACCESS_SECRET e JWT_REFRESH_SECRET devem ser diferentes');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuracao de ambiente invalida:\n- ${errors.join('\n- ')}`,
    );
  }

  return config;
}
