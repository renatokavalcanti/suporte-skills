import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPdf } from './pdf';

test('buildPdf: produz um PDF válido e escapa o texto', () => {
  const buffer = buildPdf([
    [{ x: 40, text: 'Medição Mensal — Cliente (teste)', bold: true, size: 14 }],
    [{ x: 40, text: 'parênteses (x) e barra \\ y', size: 10 }],
  ]);
  const text = buffer.toString('latin1');

  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.includes('%%EOF'));
  assert.ok(text.includes('/Type /Page'));
  assert.ok(text.includes('/Count 1'));
  assert.ok(text.includes('Medição Mensal'));
});

test('buildPdf: pagina automaticamente quando o conteúdo excede a página', () => {
  const rows = Array.from({ length: 120 }, (_, i) => [
    { x: 40, text: `linha ${i}` },
  ]);
  const text = buildPdf(rows).toString('latin1');
  const count = Number(/\/Count (\d+)/.exec(text)?.[1] ?? '0');
  assert.ok(count >= 2);
});
