export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportResult {
  key: string;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  summary?: Record<string, number>;
  generatedAt: string;
}

/**
 * Serializa um relatorio em CSV. Separador e ponto-e-virgula por padrao
 * (melhor compatibilidade com Excel em pt-BR) e inclui BOM UTF-8 para
 * acentuacao correta. A estrutura de colunas/linhas e a mesma usada no JSON,
 * permitindo adicionar um exportador XLSX no futuro sem tocar na logica.
 */
/** Prefixos que planilhas interpretam como formula (CSV injection). */
const FORMULA_TRIGGER = /^[=+@\t\r]/;

export function toCsv(report: ReportResult, separator = ';'): string {
  const escape = (value: string | number | null): string => {
    let text = value === null || value === undefined ? '' : String(value);

    // Dados de texto nao podem virar formula ao abrir no Excel/Sheets.
    if (typeof value === 'string' && FORMULA_TRIGGER.test(text)) {
      text = `'${text}`;
    }

    const needsQuotes =
      text.includes('"') ||
      text.includes('\n') ||
      text.includes('\r') ||
      text.includes(separator);
    return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = report.columns.map((column) => escape(column.label)).join(separator);
  const lines = report.rows.map((row) =>
    report.columns.map((column) => escape(row[column.key])).join(separator),
  );

  return `\uFEFF${[header, ...lines].join('\r\n')}`;
}
