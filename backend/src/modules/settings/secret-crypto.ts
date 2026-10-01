import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Cifra valores sensiveis salvos via interface (ex.: chave da API de IA) com
 * AES-256-GCM. A chave e' derivada por scrypt de um segredo de ambiente; o
 * texto cifrado e' opaco e nunca volta pela API. Formato: v1:iv:tag:dados
 * (base64). `decryptSecret` devolve null quando o segredo mudou ou o dado foi
 * corrompido - o chamador trata como "sem chave".
 */
const PREFIX = 'v1';
const SALT = 'suporte-skills/settings/v1';

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    data.toString('base64'),
  ].join(':');
}

export function decryptSecret(
  payload: string,
  secret: string,
): string | null {
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(':');
    if (version !== PREFIX || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      deriveKey(secret),
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}
