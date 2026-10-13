import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMimeMessage,
  encodeHeader,
  formatCurrencyBRL,
  formatDateBR,
} from './email';

test('formatCurrencyBRL: formato pt-BR', () => {
  assert.ok(formatCurrencyBRL(1234.56).startsWith('R$'));
  assert.ok(formatCurrencyBRL(1234.56).includes('1.234,56'));
  assert.ok(formatCurrencyBRL(0).includes('0,00'));
});

test('formatDateBR: dd/mm/aaaa no fuso informado', () => {
  assert.equal(
    formatDateBR(new Date('2026-10-05T12:00:00Z'), 'America/Sao_Paulo'),
    '05/10/2026',
  );
  // 01/11 02:00 UTC = 31/10 23:00 em BRT -> ainda outubro.
  assert.equal(
    formatDateBR(new Date('2026-11-01T02:00:00Z'), 'America/Sao_Paulo'),
    '31/10/2026',
  );
});

test('encodeHeader: ASCII passa direto; acento vira RFC 2047', () => {
  assert.equal(encodeHeader('Teste simples'), 'Teste simples');
  assert.ok(encodeHeader('Liberação').startsWith('=?UTF-8?B?'));
});

test('buildMimeMessage: multipart com anexo PDF (e .eml reutilizavel)', () => {
  const buffer = buildMimeMessage({
    from: { name: 'Suporte', address: 'a@x.com' },
    to: ['b@y.com'],
    subject: 'Liberação de Faturamento',
    text: 'texto',
    html: '<p>texto</p>',
    attachments: [
      {
        filename: 'r.pdf',
        contentType: 'application/pdf',
        content: Buffer.from('%PDF-1.4'),
      },
    ],
  });
  const raw = buffer.toString('utf8');
  assert.ok(raw.includes('MIME-Version: 1.0'));
  assert.ok(raw.includes('multipart/mixed'));
  assert.ok(raw.includes('multipart/alternative'));
  assert.ok(raw.includes('Content-Type: application/pdf; name="r.pdf"'));
  assert.ok(raw.includes('Content-Disposition: attachment; filename="r.pdf"'));
  assert.ok(raw.includes('Subject: =?UTF-8?B?'));
});

test('buildMimeMessage: sem anexo usa apenas multipart/alternative', () => {
  const raw = buildMimeMessage({
    from: { name: '', address: 'a@x.com' },
    to: ['b@y.com'],
    subject: 'Sem anexo',
    text: 't',
    html: '<p>t</p>',
  }).toString('utf8');
  assert.ok(raw.includes('multipart/alternative'));
  assert.ok(!raw.includes('multipart/mixed'));
});
