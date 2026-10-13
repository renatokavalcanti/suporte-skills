/**
 * Gerador de PDF minimo (sem dependencia externa). Produz um PDF 1.4 com texto
 * em Helvetica/Helvetica-Bold (encoding WinAnsi, para acentos do pt-BR). Cada
 * "linha" e um conjunto de celulas posicionadas em x (pontos); a paginacao e
 * automatica (A4 retrato). Suficiente para comprovantes/medicoes e, com
 * `PdfOptions`, para relatorios com cabecalho/rodape repetidos e graficos.
 */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const DEFAULT_SIZE = 10;

export interface PdfCell {
  x: number;
  text: string;
  bold?: boolean;
  size?: number;
}

export type PdfRow = PdfCell[];

/** Barra de um grafico simples (desenhado no topo da primeira pagina). */
export interface PdfChartBar {
  label: string;
  value: number;
  /** Cor RGB 0..1 (padrao cinza). */
  color?: [number, number, number];
}

export interface PdfChart {
  x: number;
  y: number;
  width: number;
  height: number;
  bars: PdfChartBar[];
  title?: string;
}

export interface PdfOptions {
  /** Desenhado no topo de TODA pagina. */
  header?: PdfRow[];
  /** Repetido no topo do corpo em CADA pagina (cabecalho de tabela). */
  tableHeader?: PdfRow[];
  /** Desenhado no rodape de TODA pagina. Aceita {{page}} e {{total}}. */
  footer?: PdfRow[];
  /** Graficos vetoriais simples (desenhados na primeira pagina). */
  charts?: PdfChart[];
}

function escapeText(value: string): string {
  let out = '';
  for (const ch of value.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 63;
    // Fora do Latin-1 nao cabe no WinAnsi: substitui para nao corromper o PDF.
    out += code <= 0xff && code !== 10 && code !== 13 ? ch : '?';
  }
  return out.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function rowHeight(row: PdfRow): number {
  const size = row.reduce((max, cell) => Math.max(max, cell.size ?? DEFAULT_SIZE), 8);
  return size + 6;
}

function placeRow(lines: string[], row: PdfRow, y: number): void {
  for (const cell of row) {
    const font = cell.bold ? '/F2' : '/F1';
    const size = cell.size ?? DEFAULT_SIZE;
    lines.push(
      `BT ${font} ${size} Tf ${cell.x.toFixed(2)} ${y.toFixed(2)} Td ` +
        `(${escapeText(cell.text)}) Tj ET`,
    );
  }
}

function drawCharts(lines: string[], charts: PdfChart[]): void {
  for (const chart of charts) {
    const maxValue = Math.max(1, ...chart.bars.map((bar) => bar.value));
    const gap = chart.bars.length > 1 ? 6 : 0;
    const barWidth = (chart.width - gap * (chart.bars.length - 1)) / Math.max(1, chart.bars.length);
    chart.bars.forEach((bar, index) => {
      const ratio = bar.value / maxValue;
      const barHeight = Math.max(1, ratio * (chart.height - 14));
      const x = chart.x + index * (barWidth + gap);
      const [r, g, b] = bar.color ?? [0.2, 0.4, 0.8];
      lines.push(
        `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ` +
          `${chart.y.toFixed(2)} ${barWidth.toFixed(2)} ${barHeight.toFixed(2)} re f`,
      );
      const label = bar.label.length > 10 ? `${bar.label.slice(0, 9)}?` : bar.label;
      lines.push(
        `BT /F1 7 Tf ${(x).toFixed(2)} ${(chart.y - 9).toFixed(2)} Td (${escapeText(label)}) Tj ET`,
      );
    });
    if (chart.title) {
      lines.push(
        `BT /F2 9 Tf ${chart.x.toFixed(2)} ${(chart.y + chart.height + 4).toFixed(2)} Td ` +
          `(${escapeText(chart.title)}) Tj ET`,
      );
    }
  }
}

function assembleFile(pages: string[]): Buffer {
  const pageCount = pages.length;
  const kids: string[] = [];
  for (let i = 0; i < pageCount; i += 1) {
    kids.push(`${6 + i * 2} 0 R`);
  }

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];

  const pushObj = (num: number, body: string): void => {
    offsets[num] = pdf.length;
    pdf += `${num} 0 obj\n${body}\nendobj\n`;
  };

  pushObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  pushObj(2, `<< /Type /Pages /Kids [ ${kids.join(' ')} ] /Count ${pageCount} >>`);
  pushObj(
    3,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  );
  pushObj(
    4,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );

  pages.forEach((content, i) => {
    const contentObj = 5 + i * 2;
    const pageObj = 6 + i * 2;
    pushObj(
      contentObj,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
    pushObj(
      pageObj,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj} 0 R >>`,
    );
  });

  const total = 5 + (pageCount - 1) * 2 + 1; // ultimo numero de objeto
  const xrefOffset = pdf.length;

  let xref = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let num = 1; num <= total; num += 1) {
    xref += `${String(offsets[num] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  pdf += xref;
  pdf += `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // Latin-1: 1 byte por caractere, mantendo os offsets coerentes.
  return Buffer.from(pdf, 'latin1');
}

/** Layout simples (sem cabecalho/rodape/graficos): comportamento original. */
function buildSimple(rows: PdfRow[]): Buffer {
  const pages: string[] = [];
  let lines: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const flush = (): void => {
    pages.push(lines.join('\n'));
    lines = [];
  };

  for (const row of rows) {
    const leading = rowHeight(row);
    if (y - leading < MARGIN) {
      flush();
      y = PAGE_HEIGHT - MARGIN;
    }
    placeRow(lines, row, y);
    y -= leading;
  }

  flush();
  if (pages.length === 0) pages.push('');
  return assembleFile(pages);
}

function buildWithOptions(rows: PdfRow[], options: PdfOptions): Buffer {
  const header = options.header ?? [];
  const tableHeader = options.tableHeader ?? [];
  const footer = options.footer ?? [];
  const charts = options.charts ?? [];

  const headerH = header.reduce((sum, row) => sum + rowHeight(row), 0);
  const tableHeaderH = tableHeader.reduce((sum, row) => sum + rowHeight(row), 0);
  const footerH = footer.reduce((sum, row) => sum + rowHeight(row), 0);

  const bodyTop = PAGE_HEIGHT - MARGIN - headerH - tableHeaderH;
  const bodyBottom = MARGIN + footerH + (charts.length > 0 ? 120 : 0);

  // Paginacao do corpo.
  const pages: PdfRow[][] = [];
  let current: PdfRow[] = [];
  let y = bodyTop;
  for (const row of rows) {
    const leading = rowHeight(row);
    if (y - leading < bodyBottom && current.length > 0) {
      pages.push(current);
      current = [];
      y = bodyTop;
    }
    current.push(row);
    y -= leading;
  }
  pages.push(current);
  if (pages.length === 0) pages.push([]);

  const rendered = pages.map((pageRows, index) => {
    const lines: string[] = [];
    let hy = PAGE_HEIGHT - MARGIN;
    for (const row of header) {
      placeRow(lines, row, hy);
      hy -= rowHeight(row);
    }
    for (const row of tableHeader) {
      placeRow(lines, row, hy);
      hy -= rowHeight(row);
    }
    let by = bodyTop;
    for (const row of pageRows) {
      placeRow(lines, row, by);
      by -= rowHeight(row);
    }
    let fy = MARGIN + footerH;
    for (const row of footer) {
      fy -= rowHeight(row);
      const replaced = row.map((cell) => ({
        ...cell,
        text: cell.text
          .replace(/\{\{page\}\}/g, String(index + 1))
          .replace(/\{\{total\}\}/g, String(pages.length)),
      }));
      placeRow(lines, replaced, fy);
    }
    if (index === 0 && charts.length > 0) drawCharts(lines, charts);
    return lines.join('\n');
  });

  return assembleFile(rendered);
}

export function buildPdf(rows: PdfRow[], options?: PdfOptions): Buffer {
  const hasOptions =
    options !== undefined &&
    ((options.header?.length ?? 0) > 0 ||
      (options.tableHeader?.length ?? 0) > 0 ||
      (options.footer?.length ?? 0) > 0 ||
      (options.charts?.length ?? 0) > 0);
  return hasOptions ? buildWithOptions(rows, options as PdfOptions) : buildSimple(rows);
}
