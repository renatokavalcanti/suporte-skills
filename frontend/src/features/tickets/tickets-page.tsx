import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Inbox, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { clientsService } from '@/services/clients.service';
import { ticketsService } from '@/services/tickets.service';
import { extractApiError } from '@/services/api';
import { formatDate } from '@/utils/labels';
import { UnmappedDialog } from './unmapped-dialog';

const billableOptions = [
  { value: 'true', label: 'Faturáveis' },
  { value: 'false', label: 'Não faturáveis' },
];

function slaBadge(value: boolean | null) {
  if (value === true) return <Badge variant="success">Conforme</Badge>;
  if (value === false) return <Badge variant="danger">Violado</Badge>;
  return <Badge variant="neutral">—</Badge>;
}

export function TicketsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = usePermissions();

  const [page, setPage] = useState(1);
  const [clientId, setClientId] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [billable, setBillable] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [unmappedOpen, setUnmappedOpen] = useState(false);

  const clientsQuery = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => clientsService.list({ pageSize: 100 }),
  });

  const params = useMemo(
    () => ({
      page,
      pageSize: 15,
      clientId: clientId || undefined,
      search: debouncedSearch || undefined,
      from: from || undefined,
      to: to || undefined,
      billable: billable === '' ? undefined : billable === 'true',
    }),
    [page, clientId, debouncedSearch, from, to, billable],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'list', params],
    queryFn: () => ticketsService.list(params),
  });

  const syncMutation = useMutation({
    mutationFn: () => ticketsService.sync(),
    onSuccess: (summary) => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({
        title: 'Sincronização concluída',
        description: `${summary.created} novo(s), ${summary.updated} atualizado(s), ${summary.unmapped} sem cliente.`,
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível sincronizar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const refreshHoursMutation = useMutation({
    mutationFn: () => ticketsService.refreshTimeEntries(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['measurements'] });
      toast({
        title: 'Horas atualizadas',
        description: `${result.tickets} chamado(s), ${result.entries} lançamento(s)${
          result.errors ? `, ${result.errors} erro(s)` : ''
        }.`,
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível atualizar as horas',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const clientOptions =
    clientsQuery.data?.data.map((client) => ({
      value: client.id,
      label: client.name,
    })) ?? [];

  return (
    <>
      <PageHeader
        title="Tickets"
        description="Chamados do Zoho Desk espelhados localmente (somente leitura)."
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setUnmappedOpen(true)}>
                <Inbox className="h-4 w-4" />
                Não mapeados
              </Button>
              <Button
                variant="outline"
                onClick={() => refreshHoursMutation.mutate()}
                disabled={refreshHoursMutation.isPending}
              >
                <Clock
                  className={`h-4 w-4 ${refreshHoursMutation.isPending ? 'animate-spin' : ''}`}
                />
                Atualizar horas
              </Button>
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw
                  className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}
                />
                Sincronizar agora
              </Button>
            </div>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
          <Select
            className="lg:w-56"
            placeholder="Todos os clientes"
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setPage(1);
            }}
            options={clientOptions}
          />
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por título ou número"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Input
            className="lg:w-40"
            type="date"
            aria-label="Encerrado a partir de"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
          <Input
            className="lg:w-40"
            type="date"
            aria-label="Encerrado até"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
          <Select
            className="lg:w-44"
            placeholder="Faturamento"
            value={billable}
            onChange={(event) => {
              setBillable(event.target.value);
              setPage(1);
            }}
            options={billableOptions}
          />
        </div>

        {isLoading && <TableSkeleton rows={8} />}
        {isError && (
          <ErrorState
            message="Não foi possível carregar os chamados."
            onRetry={() => void refetch()}
          />
        )}
        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhum chamado encontrado"
            description="Ajuste os filtros ou sincronize com o Zoho."
          />
        )}

        {data && data.data.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Encerrado em</TableHead>
                  <TableHead className="text-right">Min.</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Faturável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {ticket.ticketNumber ?? ticket.zohoTicketId}
                    </TableCell>
                    <TableCell className="max-w-[20rem] truncate font-medium text-slate-900 dark:text-slate-100">
                      {ticket.title}
                    </TableCell>
                    <TableCell>{ticket.client.name}</TableCell>
                    <TableCell>
                      <Badge variant="info">{ticket.status}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(ticket.closeDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {ticket.timeSpentMinutes}
                    </TableCell>
                    <TableCell>{slaBadge(ticket.slaCompliant)}</TableCell>
                    <TableCell>
                      <Badge variant={ticket.isBillable ? 'success' : 'neutral'}>
                        {ticket.isBillable ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      <UnmappedDialog open={unmappedOpen} onClose={() => setUnmappedOpen(false)} />
    </>
  );
}
