import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Download,
  Eye,
  FilePlus2,
  Mail,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { extractApiError } from '@/services/api';
import { clientsService } from '@/services/clients.service';
import { ticketReportsService } from '@/services/ticket-reports.service';
import { MONTHS_PT, monthLabel } from './months';
import { FinancialPreviewDialog } from './financial-preview-dialog';
import type { GeneratedReport, PeriodParams } from '@/types/reports';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - i;
  return { value: String(y), label: String(y) };
});
const monthOptions = MONTHS_PT.map((_, index) => ({
  value: String(index + 1),
  label: monthLabel(index + 1),
}));
const typeLabels: Record<string, string> = {
  FINANCIAL: 'Financeiro',
  CLIENT: 'Cliente',
};

function minutesLabel(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TicketReportsPage() {
  const { canWrite } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const now = new Date();
  const [clientId, setClientId] = useState('');
  const [mode, setMode] = useState<'MONTH' | 'RANGE'>('MONTH');
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [highlights, setHighlights] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [reportType, setReportType] = useState<'FINANCIAL' | 'CLIENT'>('FINANCIAL');
  const [financeOpen, setFinanceOpen] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [listClient, setListClient] = useState('');

  const clientsQuery = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => clientsService.list({ pageSize: 100 }),
  });

  const periodParams: PeriodParams = useMemo(() => {
    const base = clientId ? { clientId } : {};
    return mode === 'MONTH'
      ? { ...base, year: Number(year), month: Number(month) }
      : { ...base, from, to };
  }, [clientId, mode, year, month, from, to]);

  const previewMutation = useMutation({
    mutationFn: () => ticketReportsService.preview(periodParams),
    onError: (error) =>
      toast({ title: 'Não foi possível gerar a prévia', description: extractApiError(error), variant: 'error' }),
  });

  const preview = previewMutation.data;

  const generate = useMutation({
    mutationFn: () =>
      ticketReportsService.generate({
        ...periodParams,
        clientId,
        type: reportType,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket-reports', 'list'] });
      toast({ title: 'Relatório registrado', variant: 'success' });
    },
    onError: (error) =>
      toast({ title: 'Não foi possível registrar', description: extractApiError(error), variant: 'error' }),
  });

  const clientPreview = useMutation({
    mutationFn: () =>
      ticketReportsService.clientPreview({ ...periodParams, clientId, highlights, recommendations }),
    onSuccess: (data) => {
      const url = URL.createObjectURL(new Blob([data.html], { type: 'text/html' }));
      window.open(url, '_blank', 'noopener');
    },
    onError: (error) =>
      toast({ title: 'Não foi possível abrir a prévia', description: extractApiError(error), variant: 'error' }),
  });

  const clientPdf = useMutation({
    mutationFn: () =>
      ticketReportsService.clientPdf({ ...periodParams, clientId, highlights, recommendations }),
    onSuccess: ({ blob, filename }) => downloadBlob(blob, filename),
    onError: (error) =>
      toast({ title: 'Não foi possível baixar o PDF', description: extractApiError(error), variant: 'error' }),
  });

  const listQuery = useQuery({
    queryKey: ['ticket-reports', 'list', listPage, listClient],
    queryFn: () =>
      ticketReportsService.list({
        page: listPage,
        pageSize: 10,
        clientId: listClient || undefined,
      }),
  });

  const clientOptions =
    clientsQuery.data?.data.map((client) => ({ value: client.id, label: client.name })) ?? [];

  const needsClient = !clientId;

  return (
    <>
      <PageHeader
        title="Relatórios de Chamados"
        description="Prévia das métricas, faturamento e geração dos relatórios (Financeiro e Cliente)."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tr-client">Cliente</Label>
              <Select
                id="tr-client"
                placeholder="Todos os clientes"
                options={clientOptions}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-mode">Período</Label>
              <Select
                id="tr-mode"
                options={[
                  { value: 'MONTH', label: 'Mês/ano' },
                  { value: 'RANGE', label: 'Intervalo' },
                ]}
                value={mode}
                onChange={(e) => setMode(e.target.value as 'MONTH' | 'RANGE')}
              />
            </div>
            {mode === 'MONTH' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="tr-month">Mês</Label>
                  <Select
                    id="tr-month"
                    options={monthOptions}
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tr-year">Ano</Label>
                  <Select
                    id="tr-year"
                    options={yearOptions}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="tr-from">De</Label>
                  <Input id="tr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tr-to">Até</Label>
                  <Input id="tr-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending || (mode === 'RANGE' && (!from || !to))}
            >
              {previewMutation.isPending && <Spinner className="h-4 w-4 text-white" />}
              Gerar prévia
            </Button>
          </div>
        </CardContent>
      </Card>

      {previewMutation.isError && (
        <Card>
          <CardContent className="pt-4">
            <ErrorState message="Não foi possível gerar a prévia." onRetry={() => previewMutation.mutate()} />
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>
              Prévia {preview.client ? `— ${preview.client.name}` : '— todos os clientes'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Fechados no período', value: preview.metrics.closedCount },
                { label: 'Abertos ao fim', value: preview.metrics.openAtEndCount },
                { label: 'Horas', value: preview.metrics.hoursLabel },
                {
                  label: 'Tempo médio de solução',
                  value: preview.metrics.averageResolutionLabel ?? '—',
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            {preview.billing && (
              <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  Faturamento:{' '}
                  <Badge variant={preview.billing.status === 'STANDARD' ? 'success' : 'warning'}>
                    {preview.billing.status === 'STANDARD' ? 'PADRÃO' : 'COM HORAS ADICIONAIS'}
                  </Badge>
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Franqueadas: {minutesLabel(preview.billing.includedMinutes)} · Consumidas:{' '}
                  {minutesLabel(preview.billing.consumedMinutes)} · Adicionais:{' '}
                  {minutesLabel(preview.billing.extraMinutes)} · Total:{' '}
                  <strong>{brl(preview.billing.totalValue)}</strong>
                </p>
              </div>
            )}

            {preview.alerts.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/50 dark:bg-amber-900/20">
                <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas ({preview.alerts.length})
                </p>
                <ul className="mt-1 list-disc pl-5 text-amber-700 dark:text-amber-300">
                  {preview.alerts.slice(0, 8).map((alert, index) => (
                    <li key={`${alert.type}-${alert.ticketId ?? alert.clientId ?? index}`}>
                      {alert.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tr-highlights">Principais atuações (Relatório do Cliente)</Label>
                <Textarea
                  id="tr-highlights"
                  rows={3}
                  value={highlights}
                  onChange={(e) => setHighlights(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tr-reco">Pendências e recomendações</Label>
                <Textarea
                  id="tr-reco"
                  rows={3}
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                />
              </div>
            </div>

            {canWrite && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Select
                  className="w-40"
                  options={[
                    { value: 'FINANCIAL', label: 'Financeiro' },
                    { value: 'CLIENT', label: 'Cliente' },
                  ]}
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as 'FINANCIAL' | 'CLIENT')}
                />
                <Button
                  variant="outline"
                  onClick={() => generate.mutate()}
                  disabled={needsClient || generate.isPending}
                >
                  <FilePlus2 className="h-4 w-4" />
                  Registrar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => clientPreview.mutate()}
                  disabled={needsClient || clientPreview.isPending}
                >
                  <Eye className="h-4 w-4" />
                  Prévia do Cliente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => clientPdf.mutate()}
                  disabled={needsClient || clientPdf.isPending}
                >
                  <Download className="h-4 w-4" />
                  PDF do Cliente
                </Button>
                <Button onClick={() => setFinanceOpen(true)} disabled={needsClient}>
                  <Mail className="h-4 w-4" />
                  Relatório Financeiro
                </Button>
              </div>
            )}
            {needsClient && (
              <p className="text-right text-xs text-slate-500 dark:text-slate-400">
                Escolha um cliente para gerar os relatórios.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Relatórios gerados</CardTitle>
          <Select
            className="w-56"
            placeholder="Todos os clientes"
            options={clientOptions}
            value={listClient}
            onChange={(e) => {
              setListClient(e.target.value);
              setListPage(1);
            }}
          />
        </CardHeader>
        {listQuery.isLoading && <EmptyState title="Carregando..." />}
        {listQuery.data && listQuery.data.data.length === 0 && (
          <EmptyState title="Nenhum relatório gerado" description="Gere um relatório a partir da prévia." />
        )}
        {listQuery.data && listQuery.data.data.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gerado por</TableHead>
                  <TableHead>Enviado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.data.map((report: GeneratedReport) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                      {report.client.name}
                    </TableCell>
                    <TableCell>{typeLabels[report.type]}</TableCell>
                    <TableCell>
                      {report.periodStart.slice(0, 10)} → {report.periodEnd.slice(0, 10)}
                    </TableCell>
                    <TableCell>
                      {report.billingStatus === 'WITH_EXTRA_HOURS'
                        ? 'Com hora extra'
                        : report.billingStatus === 'STANDARD'
                          ? 'Padrão'
                          : '—'}
                    </TableCell>
                    <TableCell>{report.generatedBy?.name ?? '—'}</TableCell>
                    <TableCell>
                      {report.sentAt ? new Date(report.sentAt).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination meta={listQuery.data.meta} onPageChange={setListPage} />
          </>
        )}
      </Card>

      <FinancialPreviewDialog
        open={financeOpen}
        params={clientId ? periodParams : null}
        onClose={() => setFinanceOpen(false)}
        onSent={() => void queryClient.invalidateQueries({ queryKey: ['ticket-reports', 'list'] })}
      />
    </>
  );
}
