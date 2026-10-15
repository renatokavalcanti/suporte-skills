/**
 * Ambiente de execucao da aplicacao (D-038). Definido no **build** da SPA via
 * `VITE_APP_ENVIRONMENT` (repassado do `APP_ENVIRONMENT` no docker-compose):
 * PRD = producao (Azure) · HML = homologacao (VM local) · DEV = local.
 */
export type AppEnvironment = 'PRD' | 'HML' | 'DEV';

const RAW = (import.meta.env.VITE_APP_ENVIRONMENT ?? 'DEV')
  .toString()
  .trim()
  .toUpperCase();

export const APP_ENVIRONMENT: AppEnvironment =
  RAW === 'PRD' || RAW === 'HML' ? RAW : 'DEV';

export const ENVIRONMENT_META: Record<
  AppEnvironment,
  { label: string; description: string; badge: 'danger' | 'warning' | 'success' }
> = {
  PRD: { label: 'PRD', description: 'Produção (Azure)', badge: 'danger' },
  HML: { label: 'HML', description: 'Homologação (VM local)', badge: 'warning' },
  DEV: { label: 'DEV', description: 'Desenvolvimento (local)', badge: 'success' },
};
