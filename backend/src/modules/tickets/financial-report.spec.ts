import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FinancialReportData,
  buildFinancialEmail,
  buildFinancialSubject,
} from './financial-report';

const BASE: FinancialReportData = {
  clientName: 'ACME',
  planName: 'Bronze',
  periodLabel: '10/2026',
  statusLabel: 'PADRÃO',
  includedLabel: '20:00',
  consumedLabel: '10:00',
  extraLabel: '00:00',
  extraHourValueLabel: 'R$ 200,00',
  closedCount: 3,
  openedCount: 1,
  monthlyValueLabel: 'R$ 1.000,00',
  extraAmountLabel: 'R$ 0,00',
  totalValueLabel: 'R$ 1.000,00',
  tickets: [],
};

const COMPANY = { name: 'Suporte Informática' };

test('assunto segue o padrao [Liberação de Faturamento]', () => {
  assert.equal(
    buildFinancialSubject(BASE),
    '[Liberação de Faturamento] ACME – 10/2026 – PADRÃO',
  );
});

test('corpo PADRÃO: faturar apenas o mensal', () => {
  const { text, html } = buildFinancialEmail(BASE, COMPANY);
  assert.ok(text.includes('PADRÃO'));
  assert.ok(text.includes('faturar apenas o valor mensal'));
  assert.ok(text.includes('R$ 1.000,00'));
  assert.ok(html.includes('PADRÃO'));
});

test('corpo COM HORAS ADICIONAIS: mensal + adicionais = total', () => {
  const data: FinancialReportData = {
    ...BASE,
    statusLabel: 'COM HORAS ADICIONAIS',
    extraLabel: '02:00',
    extraAmountLabel: 'R$ 400,00',
    totalValueLabel: 'R$ 1.400,00',
  };
  const { subject, text, html } = buildFinancialEmail(data, COMPANY);
  assert.ok(subject.endsWith('COM HORAS ADICIONAIS'));
  assert.ok(text.includes('R$ 400,00'));
  assert.ok(text.includes('R$ 1.400,00'));
  assert.ok(html.includes('COM HORAS ADICIONAIS'));
});
