import { randomBytes } from 'crypto';

/** Anexo de um e-mail (conteudo em memoria). */
export interface MailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

/** Mensagem de e-mail simples (HTML + texto + anexos). */
export interface MailMessage {
  from: { name: string; address: string };
  to: string[];
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachment[];
}

/** Codifica um cabecalho com acentos (RFC 2047 base64 UTF-8). */
export function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** Formata um numero como moeda pt-BR: R$ 1.234,56. */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

/** Formata uma data como dd/mm/aaaa no fuso informado (padrao UTC). */
export function formatDateBR(date: Date, timeZone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  return parts;
}

function wrap76(base64: string): string {
  return base64.replace(/(.{76})/g, '$1\r\n');
}

/**
 * Monta a mensagem MIME completa (multipart/mixed -> alternative + anexos).
 * Usada tanto no download `.eml` quanto no envio por SMTP.
 */
export function buildMimeMessage(message: MailMessage): Buffer {
  const boundaryMixed = `mix_${randomBytes(12).toString('hex')}`;
  const boundaryAlt = `alt_${randomBytes(12).toString('hex')}`;
  const headerFrom =
    message.from.name !== ''
      ? `${encodeHeader(message.from.name)} <${message.from.address}>`
      : message.from.address;

  const lines: string[] = [
    'MIME-Version: 1.0',
    `From: ${headerFrom}`,
    `To: ${message.to.join(', ')}`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomBytes(12).toString('hex')}@suporte-skills>`,
  ];

  const hasAttachments = (message.attachments?.length ?? 0) > 0;

  lines.push(
    hasAttachments
      ? `Content-Type: multipart/mixed; boundary="${boundaryMixed}"`
      : `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
    '',
  );

  const alternative = [
    `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
    '',
    `--${boundaryAlt}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(message.text, 'utf8').toString('base64')),
    `--${boundaryAlt}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(message.html, 'utf8').toString('base64')),
    `--${boundaryAlt}--`,
    '',
  ];

  if (hasAttachments) {
    lines.push(`--${boundaryMixed}`, ...alternative);
    for (const attachment of message.attachments ?? []) {
      lines.push(
        `--${boundaryMixed}`,
        `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        '',
        wrap76(attachment.content.toString('base64')),
      );
    }
    lines.push(`--${boundaryMixed}--`, '');
  } else {
    lines.push(...alternative);
  }

  return Buffer.from(lines.join('\r\n'), 'utf8');
}
