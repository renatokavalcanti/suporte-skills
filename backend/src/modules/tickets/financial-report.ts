export interface FinancialTicketLine {
  number: string | null;
  openDate: string; // dd/mm/aaaa
  closeDate: string; // dd/mm/aaaa
  subject: string;
  technology: string;
  hoursLabel: string; // HH:MM
}

export interface FinancialReportData {
  clientName: string;
  planName: string | null;
  periodLabel: string; // mm/aaaa
  statusLabel: 'PADRÃO' | 'COM HORAS ADICIONAIS';
  includedLabel: string;
  consumedLabel: string;
  extraLabel: string;
  extraHourValueLabel: string;
  closedCount: number;
  openedCount: number;
  monthlyValueLabel: string;
  extraAmountLabel: string;
  totalValueLabel: string;
  tickets: FinancialTicketLine[];
}

export interface CompanySignature {
  name: string;
  contactLine?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Assunto no padrao: [Liberação de Faturamento] {cliente} – {mm/aaaa} – {status}. */
export function buildFinancialSubject(data: FinancialReportData): string {
  return `[Liberação de Faturamento] ${data.clientName} – ${data.periodLabel} – ${data.statusLabel}`;
}

export function buildFinancialText(
  data: FinancialReportData,
  company: CompanySignature,
): string {
  const lines = [
    'Prezado(a) Financeiro,',
    '',
    `O fechamento do período ${data.periodLabel} do cliente ${data.clientName} está concluído e podemos seguir com o faturamento.`,
    '',
    `Cliente: ${data.clientName}`,
    `Contrato/Plano: ${data.planName ?? '-'}`,
    `Horas franqueadas: ${data.includedLabel}`,
    `Horas consumidas: ${data.consumedLabel}`,
    `Horas adicionais: ${data.extraLabel}`,
    `Valor da hora adicional: ${data.extraHourValueLabel}`,
    `Chamados fechados: ${data.closedCount}`,
    `Chamados abertos: ${data.openedCount}`,
    '',
  ];

  if (data.statusLabel === 'PADRÃO') {
    lines.push(
      `STATUS: PADRÃO — faturar apenas o valor mensal do contrato (${data.monthlyValueLabel}).`,
    );
  } else {
    lines.push(
      `STATUS: COM HORAS ADICIONAIS — ${data.monthlyValueLabel} (contrato) + ${data.extraAmountLabel} (horas adicionais) = ${data.totalValueLabel}.`,
    );
  }

  lines.push('', 'Atenciosamente,', company.name);
  if (company.contactLine) lines.push(company.contactLine);
  lines.push('', 'Anexo: relatório detalhado dos chamados e horas.');
  return lines.join('\n');
}

export function buildFinancialHtml(
  data: FinancialReportData,
  company: CompanySignature,
): string {
  const rows = data.tickets
    .map(
      (ticket) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.number ?? '-')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.openDate)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.closeDate)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.subject)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.technology)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(ticket.hoursLabel)}</td>
      </tr>`,
    )
    .join('');

  const statusBlock =
    data.statusLabel === 'PADRÃO'
      ? `<p style="margin:8px 0;color:#166534;background:#dcfce7;padding:12px 16px;border-radius:8px;">
           <strong>PADRÃO</strong> — faturar apenas o valor mensal do contrato
           (<strong>${escapeHtml(data.monthlyValueLabel)}</strong>).
         </p>`
      : `<p style="margin:8px 0;color:#9a3412;background:#ffedd5;padding:12px 16px;border-radius:8px;">
           <strong>COM HORAS ADICIONAIS</strong> — ${escapeHtml(data.monthlyValueLabel)} (contrato) +
           ${escapeHtml(data.extraAmountLabel)} (horas adicionais) =
           <strong>${escapeHtml(data.totalValueLabel)}</strong>.
         </p>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;margin:0;padding:24px;background:#f9fafb;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
    <h2 style="margin:0 0 4px;color:#1d4ed8;">Liberação de Faturamento</h2>
    <p style="margin:0 0 16px;color:#6b7280;">${escapeHtml(data.clientName)} – ${escapeHtml(data.periodLabel)}</p>

    <p>Prezado(a) Financeiro,</p>
    <p>O fechamento do período <strong>${escapeHtml(data.periodLabel)}</strong> do cliente
       <strong>${escapeHtml(data.clientName)}</strong> está concluído e podemos seguir com o faturamento.</p>

    <table style="border-collapse:collapse;width:100%;margin:16px 0;">
      <tbody>
        <tr><td style="padding:6px 8px;color:#6b7280;">Cliente</td><td style="padding:6px 8px;"><strong>${escapeHtml(data.clientName)}</strong></td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">Contrato/Plano</td><td style="padding:6px 8px;">${escapeHtml(data.planName ?? '-')}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">Horas franqueadas</td><td style="padding:6px 8px;">${escapeHtml(data.includedLabel)}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">Horas consumidas</td><td style="padding:6px 8px;">${escapeHtml(data.consumedLabel)}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">Horas adicionais</td><td style="padding:6px 8px;">${escapeHtml(data.extraLabel)}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">Valor da hora adicional</td><td style="padding:6px 8px;">${escapeHtml(data.extraHourValueLabel)}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">Chamados fechados</td><td style="padding:6px 8px;">${data.closedCount}</td></tr>
        <tr><td style="padding:6px 8px;color:#6b7280;">Chamados abertos</td><td style="padding:6px 8px;">${data.openedCount}</td></tr>
      </tbody>
    </table>

    ${statusBlock}

    <h3 style="margin:24px 0 8px;">Chamados fechados no período</h3>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead>
        <tr style="background:#f3f4f6;text-align:left;">
          <th style="padding:8px;">Nº</th>
          <th style="padding:8px;">Abertura</th>
          <th style="padding:8px;">Fechamento</th>
          <th style="padding:8px;">Assunto</th>
          <th style="padding:8px;">Tecnologia</th>
          <th style="padding:8px;text-align:right;">Horas</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6" style="padding:8px;color:#6b7280;">Sem chamados no período.</td></tr>'}</tbody>
    </table>

    <p style="margin-top:24px;">Atenciosamente,<br /><strong>${escapeHtml(company.name)}</strong></p>
    ${company.contactLine ? `<p style="margin:0;color:#6b7280;font-size:13px;">${escapeHtml(company.contactLine)}</p>` : ''}
    <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">Anexo: relatório detalhado dos chamados e horas.</p>
  </div>
</body></html>`;
}

export function buildFinancialEmail(
  data: FinancialReportData,
  company: CompanySignature,
): { subject: string; text: string; html: string } {
  return {
    subject: buildFinancialSubject(data),
    text: buildFinancialText(data, company),
    html: buildFinancialHtml(data, company),
  };
}
