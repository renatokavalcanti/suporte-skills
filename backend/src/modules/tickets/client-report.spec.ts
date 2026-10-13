import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClientReportData, buildClientReportHtml } from './client-report';

const BRAND = {
  companyName: 'Suporte Informática',
  primaryColor: '#1d4ed8',
  secondaryColor: '#f3f4f6',
  logoDataUrl: null,
  contactLine: 'contato@suporte.local',
  website: 'suporte.local',
};

const DATA: ClientReportData = {
  clientName: 'ACME',
  periodLabel: '10/2026',
  generatedAtLabel: '13/10/2026 09:00',
  kpis: {
    closedCount: 5,
    openCount: 2,
    usedLabel: '12:30',
    contractedLabel: '20:00',
    averageResolutionLabel: '24:00',
  },
  franchise: { percent: 62, exceeded: false, extraLabel: '00:00' },
  technologies: [
    { name: 'VMware', tickets: 3, minutes: 300, hoursLabel: '05:00' },
    { name: 'Veeam', tickets: 2, minutes: 200, hoursLabel: '03:20' },
  ],
  evolution: [
    { label: '05/2026', opened: 2, closed: 1 },
    { label: '06/2026', opened: 1, closed: 3 },
  ],
  tickets: [
    {
      number: 'SK-1',
      openDate: '01/10/2026',
      closeDate: '05/10/2026',
      subject: 'Falha de rede',
      technology: 'VMware',
      status: 'Closed',
      hoursLabel: '01:30',
    },
  ],
  highlights: 'Ajuste de rede e backup.',
  recommendations: 'Revisar a politica de backup.',
};

test('relatorio do cliente NAO contem valores financeiros (R$)', () => {
  const html = buildClientReportHtml(DATA, BRAND);
  assert.ok(!/R\$/.test(html));
  assert.ok(html.includes('Relatório de Atendimento'));
  assert.ok(html.includes('ACME'));
  assert.ok(html.includes('<svg')); // graficos
  assert.ok(html.includes('VMware'));
  assert.ok(html.includes('contato@suporte.local'));
});

test('franquia excedida: mostra horas adicionais, sem R$', () => {
  const html = buildClientReportHtml(
    { ...DATA, franchise: { percent: 100, exceeded: true, extraLabel: '02:15' } },
    BRAND,
  );
  assert.ok(html.includes('02:15'));
  assert.ok(!/R\$/.test(html));
});

test('campos editaveis vazios viram "(a preencher)"', () => {
  const html = buildClientReportHtml(
    { ...DATA, highlights: '', recommendations: '' },
    BRAND,
  );
  assert.ok(html.includes('(a preencher)'));
});
