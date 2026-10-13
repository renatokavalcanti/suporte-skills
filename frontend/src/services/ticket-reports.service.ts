import { api } from './api';
import type { Paginated } from '@/types/entities';
import type {
  ClientPreview,
  FinancialPreview,
  GeneratedReport,
  GeneratedReportType,
  PeriodParams,
  TicketReportPreview,
} from '@/types/reports';

export interface ReportListParams {
  page?: number;
  pageSize?: number;
  clientId?: string;
  type?: GeneratedReportType;
  from?: string;
  to?: string;
}

export interface SendFinancialPayload extends PeriodParams {
  clientId: string;
  type: GeneratedReportType;
  recipients?: string;
  confirm: boolean;
}

function filenameFrom(header: unknown, fallback: string): string {
  if (typeof header !== 'string') return fallback;
  const match = /filename="?([^"]+)"?/.exec(header);
  return match ? match[1] : fallback;
}

async function blobGet(
  url: string,
  params: PeriodParams & { highlights?: string; recommendations?: string },
  fallbackName: string,
): Promise<{ blob: Blob; filename: string }> {
  const res = await api.get<Blob>(url, { params, responseType: 'blob' });
  return {
    blob: res.data,
    filename: filenameFrom(res.headers['content-disposition'], fallbackName),
  };
}

export const ticketReportsService = {
  async preview(params: PeriodParams): Promise<TicketReportPreview> {
    const { data } = await api.get<TicketReportPreview>(
      '/ticket-reports/preview',
      { params },
    );
    return data;
  },
  async generate(
    payload: PeriodParams & { clientId: string; type: GeneratedReportType },
  ): Promise<{ report: GeneratedReport; preview: TicketReportPreview }> {
    const { data } = await api.post<{
      report: GeneratedReport;
      preview: TicketReportPreview;
    }>('/ticket-reports', payload);
    return data;
  },
  async list(params: ReportListParams): Promise<Paginated<GeneratedReport>> {
    const { data } = await api.get<Paginated<GeneratedReport>>(
      '/ticket-reports',
      { params },
    );
    return data;
  },
  async financialPreview(params: PeriodParams): Promise<FinancialPreview> {
    const { data } = await api.get<FinancialPreview>(
      '/ticket-reports/financial/preview',
      { params },
    );
    return data;
  },
  financialEml(params: PeriodParams) {
    return blobGet('/ticket-reports/financial/eml', params, 'faturamento.eml');
  },
  async sendFinancial(payload: SendFinancialPayload) {
    const { data } = await api.post<{
      ok: true;
      reportId: string;
      subject: string;
      sentTo: string[];
    }>('/ticket-reports/financial/send', payload);
    return data;
  },
  async clientPreview(
    params: PeriodParams & { highlights?: string; recommendations?: string },
  ): Promise<ClientPreview> {
    const { data } = await api.get<ClientPreview>(
      '/ticket-reports/client/preview',
      { params },
    );
    return data;
  },
  clientPdf(
    params: PeriodParams & { highlights?: string; recommendations?: string },
  ) {
    return blobGet('/ticket-reports/client/pdf', params, 'relatorio.pdf');
  },
};
