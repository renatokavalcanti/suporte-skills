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

test('buildPdf: repeticao de cabecalho e numeracao de paginas', () => {
  const rows = Array.from({ length: 120 }, (_, i) => [
    { x: 40, text: `linha ${i}` },
  ]);
  const text = buildPdf(rows, {
    header: [[{ x: 40, text: 'CABECALHO REPETIDO', bold: true }]],
    tableHeader: [[{ x: 40, text: 'coluna', bold: true }]],
    footer: [
      [
        { x: 40, text: 'RODAPE' },
        { x: 440, text: 'Pagina {{page}} de {{total}}' },
      ],
    ],
  }).toString('latin1');

  const count = Number(/\/Count (\d+)/.exec(text)?.[1] ?? '0');
  assert.ok(count >= 2);
  // O cabecalho aparece em TODAS as paginas.
  assert.equal((text.match(/CABECALHO REPETIDO/g) ?? []).length, count);
  assert.equal((text.match(/coluna/g) ?? []).length, count);
  assert.ok(text.includes('Pagina 1 de'));
  assert.ok(text.includes(`de ${count}`));
});

test('buildPdf: desenha grafico de barras (retangulos preenchidos)', () => {
  const text = buildPdf([[{ x: 40, text: 'x' }]], {
    charts: [
      {
        x: 40,
        y: 60,
        width: 200,
        height: 100,
        title: 'Grafico',
        bars: [
          { label: 'A', value: 3 },
          { label: 'B', value: 1 },
        ],
      },
    ],
  }).toString('latin1');
  assert.ok(text.includes(' re f')); // operador de retangulo preenchido
  assert.ok(text.includes('Grafico'));
});
