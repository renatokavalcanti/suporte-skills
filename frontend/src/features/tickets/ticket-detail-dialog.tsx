import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, RotateCcw, Unlink } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
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
import { clientsService } from '@/services/clients.service';
import { ticketsService } from '@/services/tickets.service';
import { extractApiError } from '@/services/api';
import { formatDate, formatDateTime } from '@/utils/labels';

/** Converte minutos inteiros em "Xh Ym" (ex.: 90 -> "1h 30m"). */
function formatMinutes(minutes: number): string {
  if (!minutes) return '0m';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

function slaBadge(value: boolean | null) {
  if (value === true) return <Badge variant="success">Conforme</Badge>;
  if (value === false) return <Badge variant="danger">Violado</Badge>;
  return <Badge variant="neutral">—</Badge>;
}

export function TicketDetailDialog({
  ticketId,
  onClose,
}: {
  ticketId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const open = ticketId !== null;
  const [clientId, setClientId] = useState('');

  const detailQuery = useQuery({
    queryKey: ['tickets', 'detail', ticketId],
    queryFn: () => ticketsService.get(ticketId as string),
    enabled: open,
  });

  const clientsQuery = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => clientsService.list({ pageSize: 100, active: true }),
    enabled: open && isAdmin,
  });

  useEffect(() => {
    setClientId('');
  }, [ticketId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['tickets'] });
  };

  const refreshHours = useMutation({
    mutationFn: () => ticketsService.refreshTicketTimeEntries(ticketId as string),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
      invalidate();
      toast({
        title: 'Horas atualizadas',
        description: `${result.entries} lançamento(s)${
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

  const reassign = useMutation({
    mutationFn: () => ticketsService.reassignClient(ticketId as string, clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
      invalidate();
      toast({ title: 'Cliente do chamado atualizado', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível trocar o cliente',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const unlink = useMutation({
    mutationFn: () => ticketsService.unlink(ticketId as string),
    onSuccess: () => {
      invalidate();
      toast({
        title: 'Chamado devolvido à fila de não mapeados',
        variant: 'success',
      });
      onClose();
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível desassociar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const busy = refreshHours.isPending || reassign.isPending || unlink.isPending;
  const ticket = detailQuery.data;
  const entries = ticket?.timeEntries ?? [];
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const clientOptions =
    clientsQuery.data?.data
      .filter((client) => client.id !== ticket?.client.id)
      .map((client) => ({ value: client.id, label: client.name })) ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      disableClose={busy}
      title={
        ticket
          ? `Chamado ${ticket.ticketNumber ?? ticket.zohoTicketId}`
          : 'Chamado'
      }
      description={ticket?.title}
      footer={
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Fechar
        </Button>
      }
    >
      {detailQuery.isLoading && <TableSkeleton rows={4} />}
      {detailQuery.isError && (
        <ErrorState
          message="Não foi possível carregar o chamado."
          onRetry={() => void detailQuery.refetch()}
        />
      )}

      {ticket && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Cliente</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {ticket.client.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Status</dt>
              <dd>
                <Badge variant="info">{ticket.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">SLA</dt>
              <dd>{slaBadge(ticket.slaCompliant)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Aberto em</dt>
              <dd className="text-slate-700 dark:text-slate-300">
                {formatDate(ticket.openDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Encerrado em</dt>
              <dd className="text-slate-700 dark:text-slate-300">
                {formatDate(ticket.closeDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Faturável</dt>
              <dd>
                <Badge variant={ticket.isBillable ? 'success' : 'neutral'}>
                  {ticket.isBillable ? 'Sim' : 'Não'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                {ticket.assigneeName ? 'Responsável' : 'Tecnologia'}
              </dt>
              <dd className="text-slate-700 dark:text-slate-300">
                {ticket.assigneeName ?? ticket.technologyName ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Total de horas</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {formatMinutes(ticket.timeSpentMinutes)}
              </dd>
            </div>
          </dl>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <Clock className="h-4 w-4" />
                Lançamentos de tempo
              </h3>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshHours.mutate()}
                  disabled={busy}
                >
                  <RotateCcw
                    className={`h-3.5 w-3.5 ${refreshHours.isPending ? 'animate-spin' : ''}`}
                  />
                  Atualizar horas deste chamado
                </Button>
              )}
            </div>

            {entries.length === 0 ? (
              <EmptyState
                title="Nenhum lançamento de tempo"
                description="Este chamado não possui horas lançadas no Zoho Desk."
              />
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Faturável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-slate-500">
                          {formatDateTime(entry.executedAt)}
                        </TableCell>
                        <TableCell className="max-w-[12rem] truncate">
                          {entry.ownerName ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatMinutes(entry.minutes)}
                        </TableCell>
                        <TableCell className="max-w-[18rem] truncate">
                          {entry.description ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.isBillable ? 'success' : 'neutral'}>
                            {entry.isBillable ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {entries.length > 0 && (
              <p className="mt-2 text-right text-xs text-slate-500 dark:text-slate-400">
                Total: <span className="font-medium">{formatMinutes(totalMinutes)}</span>{' '}
                em {entries.length} lançamento(s)
              </p>
            )}
          </div>

          {isAdmin && (
            <div className="space-y-3 rounded-md border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Associação ao cliente
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  className="sm:flex-1"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  placeholder="Trocar para outro cliente…"
                  options={clientOptions}
                />
                <Button
                  variant="outline"
                  disabled={!clientId || busy}
                  onClick={() => reassign.mutate()}
                >
                  Trocar cliente
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Desassociar devolve o chamado à fila de não mapeados.
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Desassociar este chamado? Ele voltará para a fila de não mapeados.',
                      )
                    ) {
                      unlink.mutate();
                    }
                  }}
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Desassociar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
