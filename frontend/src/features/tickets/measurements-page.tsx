import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FilePlus2, Eye } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/feedback';
import { usePermissions } from '@/hooks/use-permissions';
import { clientsService } from '@/services/clients.service';
import { measurementsService } from '@/services/measurements.service';
import { periodLabel } from './months';
import { GenerateMeasurementDialog } from './generate-measurement-dialog';
import { MeasurementDetailDialog } from './measurement-detail-dialog';

const statusOptions = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'CLOSED', label: 'Fechada' },
];

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, index) => {
  const year = currentYear - index;
  return { value: String(year), label: String(year) };
});

export function MeasurementsPage() {
  const { canWrite } = usePermissions();

  const [page, setPage] = useState(1);
  const [clientId, setClientId] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const clientsQuery = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => clientsService.list({ pageSize: 100 }),
  });

  const params = useMemo(
    () => ({
      page,
      pageSize: 12,
      clientId: clientId || undefined,
      year: year ? Number(year) : undefined,
      status: (status || undefined) as 'DRAFT' | 'CLOSED' | undefined,
    }),
    [page, clientId, year, status],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['measurements', 'list', params],
    queryFn: () => measurementsService.list(params),
  });

  const clientOptions =
    clientsQuery.data?.data.map((client) => ({
      value: client.id,
      label: client.name,
    })) ?? [];

  return (
    <>
      <PageHeader
        title="Medições Mensais"
        description="Consolidação dos chamados faturados por cliente/mês — comprovação de serviço."
        actions={
          canWrite && (
            <Button onClick={() => setGenerateOpen(true)}>
              <FilePlus2 className="h-4 w-4" />
              Gerar medição
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
          <Select
            className="sm:w-64"
            placeholder="Todos os clientes"
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setPage(1);
            }}
            options={clientOptions}
          />
          <Select
            className="sm:w-36"
            placeholder="Todos os anos"
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              setPage(1);
            }}
            options={yearOptions}
          />
          <Select
            className="sm:w-40"
            placeholder="Todas as situações"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={statusOptions}
          />
        </div>

        {isLoading && <TableSkeleton rows={6} />}
        {isError && (
          <ErrorState
            message="Não foi possível carregar as medições."
            onRetry={() => void refetch()}
          />
        )}
        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhuma medição encontrada"
            description="Gere uma medição para um cliente e período."
          />
        )}

        {data && data.data.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Chamados</TableHead>
                  <TableHead className="text-right">Minutos</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((measurement) => (
                  <TableRow key={measurement.id}>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                      {measurement.client.name}
                    </TableCell>
                    <TableCell>
                      {periodLabel(measurement.year, measurement.month)}
                    </TableCell>
                    <TableCell className="text-right">
                      {measurement.ticketCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {measurement.timeSpentMinutes}
                    </TableCell>
                    <TableCell>
                      {measurement.slaPercentage === null
                        ? '—'
                        : `${measurement.slaPercentage}%`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={measurement.status === 'CLOSED' ? 'success' : 'warning'}
                      >
                        {measurement.status === 'CLOSED' ? 'Fechada' : 'Rascunho'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailId(measurement.id)}
                      >
                        <Eye className="h-4 w-4" />
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      <GenerateMeasurementDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
      />
      <MeasurementDetailDialog
        id={detailId}
        onClose={() => setDetailId(null)}
      />
    </>
  );
}
