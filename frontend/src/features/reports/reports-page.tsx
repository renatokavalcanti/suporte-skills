import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/feedback';
import { useToast } from '@/components/toast';
import { professionalsService } from '@/services/professionals.service';
import { vendorsService } from '@/services/vendors.service';
import { reportsService } from '@/services/reports.service';
import { extractApiError } from '@/services/api';
import type { ReportCellValue, ReportKey, ReportResult } from '@/types/entities';
import { ConsultantsPanel } from './consultants-panel';
import {
  catalogStatusLabels,
  certificationLevelLabels,
  certificationStatusLabels,
  partnershipStatusLabels,
  roadmapPriorityLabels,
  roadmapStatusLabels,
  roadmapTypeLabels,
} from '@/utils/labels';

type ReportTab = ReportKey | 'consultants';

const reportTabs: { value: ReportTab; label: string }[] = [
  { value: 'consultants', label: 'Consultores' },
  { value: 'certifications', label: 'Certificações' },
  { value: 'expirations', label: 'Vencimentos' },
  { value: 'roadmap', label: 'Roadmap' },
  { value: 'vendors', label: 'Por fabricante' },
];

const enumLabels: Record<string, string> = {
  ...certificationStatusLabels,
  ...certificationLevelLabels,
  ...catalogStatusLabels,
  ...partnershipStatusLabels,
  ...roadmapStatusLabels,
  ...roadmapPriorityLabels,
  ...roadmapTypeLabels,
};

function formatValue(value: ReportCellValue): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && enumLabels[value]) return enumLabels[value];
  return String(value);
}

function summaryLabel(key: string): string {
  if (key === 'total') return 'Total';
  return enumLabels[key] ?? key;
}

function SummaryChips({ summary }: { summary?: Record<string, number> }) {
  if (!summary) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(summary).map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs dark:border-slate-800"
        >
          <span className="text-slate-500 dark:text-slate-400">
            {summaryLabel(key)}
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {value}
          </span>
        </span>
      ))}
    </div>
  );
}

function ReportTable({ report }: { report: ReportResult }) {
  if (report.rows.length === 0) {
    return (
      <EmptyState
        title="Nenhum registro"
        description="Ajuste os filtros para ver resultados."
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {report.columns.map((column) => (
            <TableHead key={column.key}>{column.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row, index) => (
          <TableRow
            key={String(
              report.columns
                .map((column) => row[column.key])
                .filter((value) => value !== null && value !== undefined)
                .slice(0, 3)
                .join('|') || index,
            )}
          >
            {report.columns.map((column) => (
              <TableCell
                key={column.key}
                className={
                  column.key === 'status' || column.key === 'situation' || column.key === 'bucket'
                    ? 'whitespace-nowrap'
                    : undefined
                }
              >
                {column.key === 'status' && typeof row[column.key] === 'string' && enumLabels[String(row[column.key])] ? (
                  <Badge variant="neutral">
                    {formatValue(row[column.key])}
                  </Badge>
                ) : (
                  formatValue(row[column.key])
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ReportsPage() {
  const { toast } = useToast();
  const [key, setKey] = useState<ReportTab>('consultants');
  const isConsultants = key === 'consultants';
  const [professionalId, setProfessionalId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: professionals } = useQuery({
    // Chave distinta da usada no roadmap (que filtra active=true): a mesma
    // chave com parametros diferentes contaminava a lista em cache.
    queryKey: ['professionals', 'options', 'all'],
    queryFn: () => professionalsService.list({ pageSize: 200, sort: 'name' }),
  });
  const { data: vendors } = useQuery({
    queryKey: ['vendors', 'options'],
    queryFn: () => vendorsService.list({ pageSize: 200, sort: 'name' }),
  });

  const params = useMemo(
    () => ({
      professionalId: professionalId || undefined,
      vendorId: vendorId || undefined,
    }),
    [professionalId, vendorId],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', key, params],
    queryFn: () => reportsService.get(key as ReportKey, params),
    enabled: !isConsultants,
  });

  const onExport = async (): Promise<void> => {
    if (isConsultants) return;
    setExporting(true);
    try {
      await reportsService.downloadCsv(
        key as ReportKey,
        params,
        `suporte-skills-${key}.csv`,
      );
      toast({ title: 'Exportação iniciada', variant: 'success' });
    } catch (error) {
      toast({
        title: 'Não foi possível exportar',
        description: extractApiError(error),
        variant: 'error',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Consultores, certificações, vencimentos, roadmap e visão por fabricante."
        actions={
          !isConsultants && (
            <Button variant="outline" onClick={() => void onExport()} disabled={exporting}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          )
        }
      />

      <div className="mb-4">
        <Tabs value={key} onChange={(value) => setKey(value as ReportTab)} tabs={reportTabs} />
      </div>

      {isConsultants ? (
        <ConsultantsPanel />
      ) : (
        <>
          <Card className="mb-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select
                className="sm:w-56"
                placeholder="Todos os profissionais"
                value={professionalId}
                onChange={(event) => setProfessionalId(event.target.value)}
                options={(professionals?.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <Select
                className="sm:w-56"
                placeholder="Todos os fabricantes"
                value={vendorId}
                onChange={(event) => setVendorId(event.target.value)}
                options={(vendors?.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </div>
          </Card>

          {isLoading && (
            <Card>
              <TableSkeleton rows={8} />
            </Card>
          )}

          {isError && (
            <Card>
              <ErrorState
                message="Não foi possível gerar o relatório."
                onRetry={() => void refetch()}
              />
            </Card>
          )}

          {data && (
            <div className="space-y-3">
              <SummaryChips summary={data.summary} />
              <Card className="overflow-hidden">
                <ReportTable report={data} />
              </Card>
              <p className="text-right text-xs text-slate-400">
                {data.rows.length} registro(s) · gerado em{' '}
                {new Date(data.generatedAt).toLocaleString('pt-BR')}
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
