/**
 * Gerador de PDF minimo (sem dependencia externa). Produz um PDF 1.4 com texto
 * em Helvetica/Helvetica-Bold (encoding WinAnsi, para acentos do pt-BR). Cada
 * "linha" e um conjunto de celulas posicionadas em x (pontos); a paginacao e
 * automatica (A4 retrato). Suficiente para comprovantes/medicoes.
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

function escapeText(value: string): string {
  let out = '';
  for (const ch of value.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 63;
    // Fora do Latin-1 nao cabe no WinAnsi: substitui para nao corromper o PDF.
    out += code <= 0xff && code !== 10 && code !== 13 ? ch : '?';
  }
  return out.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
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

export function buildPdf(rows: PdfRow[]): Buffer {
  const pages: string[] = [];
  let lines: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;

  const flush = (): void => {
    pages.push(lines.join('\n'));
    lines = [];
  };

  for (const row of rows) {
    const size = row.reduce((max, cell) => Math.max(max, cell.size ?? DEFAULT_SIZE), 8);
    const leading = size + 6;

    if (y - leading < MARGIN) {
      flush();
      y = PAGE_HEIGHT - MARGIN;
    }

    for (const cell of row) {
      const font = cell.bold ? '/F2' : '/F1';
      const cellSize = cell.size ?? DEFAULT_SIZE;
      lines.push(
        `BT ${font} ${cellSize} Tf ${cell.x.toFixed(2)} ${y.toFixed(2)} Td ` +
          `(${escapeText(cell.text)}) Tj ET`,
      );
    }
    y -= leading;
  }

  flush();
  if (pages.length === 0) pages.push('');
  return assembleFile(pages);
}
