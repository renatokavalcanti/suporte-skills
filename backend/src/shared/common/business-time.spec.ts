import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zonedDayRange, zonedMonthRange } from './business-time';

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

test('zonedDayRange: limites [start, end) no fuso (America/Sao_Paulo = UTC-3)', () => {
  const { start, end } = zonedDayRange('2026-10-01', '2026-10-31', TZ);
  // 00:00 em SP (UTC-3) = 03:00 UTC do mesmo dia.
  assert.equal(start.toISOString(), '2026-10-01T03:00:00.000Z');
  // Fim exclusivo: 00:00 de 01/11 em SP = 03:00 UTC.
  assert.equal(end.toISOString(), '2026-11-01T03:00:00.000Z');
});

test('zonedDayRange: chamado na virada do mes cai no mes certo', () => {
  const { start, end } = zonedMonthRange(2026, 10, TZ); // outubro
  // Fechado 31/10 23:00 em SP (UTC-3) = 01/11 02:00 UTC -> dentro de outubro.
  const virada = new Date('2026-11-01T02:00:00.000Z');
  assert.ok(virada >= start && virada < end);
  // Fechado 01/11 00:00 em SP = 03:00 UTC -> fora de outubro.
  const depois = new Date('2026-11-01T03:00:00.000Z');
  assert.ok(!(depois >= start && depois < end));
});

test('zonedDayRange: intervalo de um unico dia', () => {
  const { start, end } = zonedDayRange('2026-10-13', '2026-10-13', TZ);
  assert.equal(start.toISOString(), '2026-10-13T03:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-14T03:00:00.000Z');
});
