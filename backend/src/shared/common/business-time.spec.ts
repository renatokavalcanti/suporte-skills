import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zonedMonthRange } from './business-time';

const TZ = 'America/Sao_Paulo'; // UTC-03 (sem horario de verao)

test('zonedMonthRange: limites do mes em UTC no fuso de Sao Paulo', () => {
  const { start, end } = zonedMonthRange(2026, 10, TZ);
  // Meia-noite local (00:00 BRT) = 03:00 UTC.
  assert.equal(start.toISOString(), '2026-10-01T03:00:00.000Z');
  assert.equal(end.toISOString(), '2026-11-01T03:00:00.000Z');
});

test('zonedMonthRange: virada de ano (dezembro -> janeiro)', () => {
  const { start, end } = zonedMonthRange(2026, 12, TZ);
  assert.equal(start.toISOString(), '2026-12-01T03:00:00.000Z');
  assert.equal(end.toISOString(), '2027-01-01T03:00:00.000Z');
});

test('zonedMonthRange: UTC puro nao aplica deslocamento', () => {
  const { start, end } = zonedMonthRange(2026, 2, 'UTC');
  assert.equal(start.toISOString(), '2026-02-01T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-03-01T00:00:00.000Z');
});
