/**
 * Dominios do Zoho por data center (D-030). A tela de Configuracoes deixa o
 * ADMIN escolher o data center e a aplicacao deriva os dominios da API e do
 * OAuth a partir dele. `au` e `jp` usam dominios proprios (regra do Zoho).
 */
export type ZohoDataCenter = 'com' | 'eu' | 'in' | 'au' | 'cn' | 'jp';

export const ZOHO_DATA_CENTERS: readonly ZohoDataCenter[] = [
  'com',
  'eu',
  'in',
  'au',
  'cn',
  'jp',
];

const DOMAINS: Record<ZohoDataCenter, { api: string; accounts: string }> = {
  com: { api: 'desk.zoho.com', accounts: 'accounts.zoho.com' },
  eu: { api: 'desk.zoho.eu', accounts: 'accounts.zoho.eu' },
  in: { api: 'desk.zoho.in', accounts: 'accounts.zoho.in' },
  au: { api: 'desk.zoho.com.au', accounts: 'accounts.zoho.com.au' },
  cn: { api: 'desk.zoho.com.cn', accounts: 'accounts.zoho.com.cn' },
  jp: { api: 'desk.zoho.jp', accounts: 'accounts.zoho.jp' },
};

export function isZohoDataCenter(value: unknown): value is ZohoDataCenter {
  return typeof value === 'string' && value in DOMAINS;
}

/** Dominios de API/OAuth derivados do data center. */
export function zohoBaseUrls(dc: ZohoDataCenter): {
  apiBaseUrl: string;
  accountsBaseUrl: string;
} {
  const domains = DOMAINS[dc] ?? DOMAINS.com;
  return {
    apiBaseUrl: `https://${domains.api}/api/v1`,
    accountsBaseUrl: `https://${domains.accounts}`,
  };
}

/** Escopos pre-preenchidos (editaveis) da integracao de leitura. */
export const DEFAULT_ZOHO_SCOPES: readonly string[] = [
  'Desk.tickets.READ',
  'Desk.basic.READ',
  'Desk.contacts.READ',
  'Desk.settings.READ',
];

/** Status considerados "fechado" por padrao (rotulos do Zoho Desk). */
export const DEFAULT_CLOSED_STATUSES: readonly string[] = ['Closed'];

export type ZohoClientSource = 'ACCOUNT' | 'CONTACT';

export type ZohoSyncFrequency = 'MANUAL' | 'HOURLY' | 'SIX_HOURS' | 'DAILY';

export const ZOHO_SYNC_FREQUENCIES: readonly ZohoSyncFrequency[] = [
  'MANUAL',
  'HOURLY',
  'SIX_HOURS',
  'DAILY',
];

export function frequencyToMinutes(frequency: ZohoSyncFrequency): number {
  switch (frequency) {
    case 'HOURLY':
      return 60;
    case 'SIX_HOURS':
      return 360;
    case 'DAILY':
      return 1440;
    default:
      return 0;
  }
}

/** Frequencia mais proxima de um intervalo em minutos vindo do ambiente. */
export function minutesToFrequency(minutes: number): ZohoSyncFrequency {
  if (minutes <= 90) return 'HOURLY';
  if (minutes <= 720) return 'SIX_HOURS';
  return 'DAILY';
}
