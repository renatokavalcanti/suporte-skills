export interface ClientReportTicketLine {
  number: string | null;
  openDate: string;
  closeDate: string;
  subject: string;
  technology: string;
  status: string;
  hoursLabel: string;
}

export interface ClientReportKpis {
  closedCount: number;
  openCount: number;
  usedLabel: string;
  contractedLabel: string;
  averageResolutionLabel: string | null;
}

export interface ClientReportFranchise {
  percent: number; // 0..100
  exceeded: boolean;
  extraLabel: string; // HH:MM das horas adicionais (sem R$)
}

export interface ClientReportTechnology {
  name: string;
  tickets: number;
  minutes: number;
  hoursLabel: string;
}

export interface ClientReportEvolutionPoint {
  label: string; // mm/aaaa
  opened: number;
  closed: number;
}

export interface ClientReportData {
  clientName: string;
  periodLabel: string;
  generatedAtLabel: string;
  kpis: ClientReportKpis;
  franchise: ClientReportFranchise;
  technologies: ClientReportTechnology[];
  evolution: ClientReportEvolutionPoint[];
  tickets: ClientReportTicketLine[];
  highlights: string;
  recommendations: string;
}

export interface ClientReportBrand {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoDataUrl: string | null;
  contactLine: string;
  website: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgBars(
  items: { label: string; value: number }[],
  width: number,
  height: number,
  color: string,
): string {
  if (items.length === 0) {
    return `<p style="color:#9ca3af;">Sem dados no período.</p>`;
  }
  const max = Math.max(1, ...items.map((item) => item.value));
  const slot = width / items.length;
  const barW = Math.min(48, slot * 0.6);
  const bars = items
    .map((item, index) => {
      const barH = Math.max(1, (item.value / max) * (height - 24));
      const x = index * slot + (slot - barW) / 2;
      const y = height - 18 - barH;
      const label = item.label.length > 12 ? `${item.label.slice(0, 11)}…` : item.label;
      return (
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" rx="2" />` +
        `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-size="9" text-anchor="middle" fill="#374151">${item.value}</text>` +
        `<text x="${(x + barW / 2).toFixed(1)}" y="${height - 5}" font-size="8" text-anchor="middle" fill="#6b7280">${escapeHtml(label)}</text>`
      );
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img">${bars}</svg>`;
}

function svgGroupedBars(
  items: { label: string; opened: number; closed: number }[],
  width: number,
  height: number,
  colorOpened: string,
  colorClosed: string,
): string {
  if (items.length === 0) {
    return `<p style="color:#9ca3af;">Sem dados no período.</p>`;
  }
  const max = Math.max(1, ...items.flatMap((item) => [item.opened, item.closed]));
  const slot = width / items.length;
  const barW = Math.min(20, slot * 0.3);
  const bars = items
    .map((item, index) => {
      const base = index * slot + slot / 2;
      const hO = Math.max(1, (item.opened / max) * (height - 24));
      const hC = Math.max(1, (item.closed / max) * (height - 24));
      const yO = height - 18 - hO;
      const yC = height - 18 - hC;
      return (
        `<rect x="${(base - barW - 2).toFixed(1)}" y="${yO.toFixed(1)}" width="${barW}" height="${hO.toFixed(1)}" fill="${colorOpened}" rx="2" />` +
        `<rect x="${(base + 2).toFixed(1)}" y="${yC.toFixed(1)}" width="${barW}" height="${hC.toFixed(1)}" fill="${colorClosed}" rx="2" />` +
        `<text x="${base.toFixed(1)}" y="${height - 5}" font-size="8" text-anchor="middle" fill="#6b7280">${escapeHtml(item.label)}</text>`
      );
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img">${bars}</svg>`;
}

/**
 * Relatorio do Cliente (B5, D-030): HTML auto-contido, com identidade visual,
 * KPIs, barra de franquia, graficos, campos editaveis, tabela detalhada e
 * rodape. **Nao** contem valores financeiros do contrato.
 */
export function buildClientReportHtml(
  data: ClientReportData,
  brand: ClientReportBrand,
): string {
  const primary = brand.primaryColor;
  const logo = brand.logoDataUrl
    ? `<img src="${escapeHtml(brand.logoDataUrl)}" alt="${escapeHtml(brand.companyName)}" style="max-height:52px;max-width:200px;" />`
    : `<strong style="font-size:20px;color:${primary};">${escapeHtml(brand.companyName)}</strong>`;

  const kpis = [
    { label: 'Chamados fechados', value: String(data.kpis.closedCount) },
    { label: 'Chamados abertos', value: String(data.kpis.openCount) },
    {
      label: 'Horas utilizadas / contratadas',
      value: `${data.kpis.usedLabel} / ${data.kpis.contractedLabel}`,
    },
    {
      label: 'Tempo médio de solução',
      value: data.kpis.averageResolutionLabel ?? '-',
    },
  ]
    .map(
      (kpi) =>
        `<div style="flex:1;min-width:140px;background:${brand.secondaryColor};border-radius:10px;padding:14px 16px;">
           <div style="font-size:12px;color:#6b7280;">${escapeHtml(kpi.label)}</div>
           <div style="font-size:22px;font-weight:700;color:${primary};margin-top:4px;">${escapeHtml(kpi.value)}</div>
         </div>`,
    )
    .join('');

  const franchiseBlock = data.franchise.exceeded
    ? `<div style="margin-top:8px;color:#9a3412;">
         Franquia utilizada: <strong>${data.franchise.percent.toFixed(0)}%</strong> —
         horas adicionais no período: <strong>${escapeHtml(data.franchise.extraLabel)}</strong>.
       </div>`
    : `<div style="margin-top:8px;color:#374151;">Franquia utilizada: <strong>${data.franchise.percent.toFixed(0)}%</strong>.</div>`;

  const techChart = svgBars(
    data.technologies.map((tech) => ({ label: tech.name, value: tech.tickets })),
    520,
    160,
    primary,
  );
  const evolutionChart = svgGroupedBars(
    data.evolution,
    520,
    160,
    '#f59e0b',
    '#10b981',
  );

  const rows = data.tickets
    .map(
      (ticket) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.number ?? '-')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.openDate)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.closeDate)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.subject)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.technology)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(ticket.status)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(ticket.hoursLabel)}</td>
      </tr>`,
    )
    .join('');

  const highlights = data.highlights.trim()
    ? escapeHtml(data.highlights).replace(/\n/g, '<br />')
    : '<span style="color:#9ca3af;">(a preencher)</span>';
  const recommendations = data.recommendations.trim()
    ? escapeHtml(data.recommendations).replace(/\n/g, '<br />')
    : '<span style="color:#9ca3af;">(a preencher)</span>';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /><title>Relatório de Atendimento — ${escapeHtml(data.clientName)}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#111827;margin:0;background:#ffffff;">
  <div style="max-width:800px;margin:0 auto;padding:32px;">
    <header style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${primary};padding-bottom:12px;">
      <div>${logo}</div>
      <div style="text-align:right;">
        <div style="font-size:20px;font-weight:700;color:${primary};">Relatório de Atendimento</div>
        <div style="color:#6b7280;">${escapeHtml(data.periodLabel)}</div>
      </div>
    </header>

    <h2 style="margin:20px 0 4px;">${escapeHtml(data.clientName)}</h2>
    <p style="margin:0 0 16px;color:#6b7280;">Período: ${escapeHtml(data.periodLabel)}</p>

    <div style="display:flex;gap:12px;flex-wrap:wrap;">${kpis}</div>

    <section style="margin-top:18px;">
      <div style="height:14px;background:${brand.secondaryColor};border-radius:7px;overflow:hidden;">
        <div style="height:14px;width:${Math.min(100, data.franchise.percent).toFixed(0)}%;background:${primary};"></div>
      </div>
      ${franchiseBlock}
    </section>

    <section style="margin-top:24px;">
      <h3 style="margin:0 0 8px;">Tecnologias atendidas (chamados)</h3>
      ${techChart}
    </section>

    <section style="margin-top:20px;">
      <h3 style="margin:0 0 8px;">Evolução (chamados abertos × fechados)</h3>
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">
        <span style="color:#f59e0b;">■</span> Abertos &nbsp; <span style="color:#10b981;">■</span> Fechados
      </div>
      ${evolutionChart}
    </section>

    <section style="margin-top:20px;">
      <h3 style="margin:0 0 6px;">Principais atuações no período</h3>
      <div style="background:${brand.secondaryColor};border-radius:8px;padding:12px 14px;">${highlights}</div>
    </section>

    <section style="margin-top:16px;">
      <h3 style="margin:0 0 6px;">Pendências e recomendações</h3>
      <div style="background:${brand.secondaryColor};border-radius:8px;padding:12px 14px;">${recommendations}</div>
    </section>

    <section style="margin-top:20px;">
      <h3 style="margin:0 0 8px;">Detalhamento dos chamados</h3>
      <table style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead>
          <tr style="background:${brand.secondaryColor};text-align:left;">
            <th style="padding:8px;">Nº</th>
            <th style="padding:8px;">Abertura</th>
            <th style="padding:8px;">Fechamento</th>
            <th style="padding:8px;">Assunto</th>
            <th style="padding:8px;">Tecnologia</th>
            <th style="padding:8px;">Status</th>
            <th style="padding:8px;text-align:right;">Horas</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7" style="padding:8px;color:#6b7280;">Sem chamados no período.</td></tr>'}</tbody>
      </table>
    </section>

    <footer style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:10px;color:#6b7280;font-size:12px;">
      <div><strong>${escapeHtml(brand.companyName)}</strong></div>
      ${brand.contactLine ? `<div>${escapeHtml(brand.contactLine)}</div>` : ''}
      ${brand.website ? `<div>${escapeHtml(brand.website)}</div>` : ''}
      <div>Relatório gerado em ${escapeHtml(data.generatedAtLabel)}.</div>
    </footer>
  </div>
</body></html>`;
}
