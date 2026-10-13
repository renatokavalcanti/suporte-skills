import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';

/**
 * Segredo usado para cifrar valores sensiveis salvos via interface
 * (`SETTINGS_ENCRYPTION_KEY`; vazio cai no segredo de acesso do JWT). Centraliza
 * a regra para que a cifra de IA e a do Zoho usem exatamente o mesmo segredo.
 */
export function resolveEncryptionSecret(config: ConfigService): string {
  const configured =
    config.get<AppConfiguration['settings']>('settings')?.encryptionKey;
  if (configured) return configured;
  return config.get<AppConfiguration['auth']>('auth')?.accessSecret ?? '';
}
