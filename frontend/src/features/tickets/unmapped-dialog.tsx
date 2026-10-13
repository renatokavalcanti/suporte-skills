import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Search } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { clientsService } from '@/services/clients.service';
import { ticketsService } from '@/services/tickets.service';
import { extractApiError } from '@/services/api';
import { formatDateTime } from '@/utils/labels';

export function UnmappedDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState('');

  const clientsQuery = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => clientsService.list({ pageSize: 100, active: true }),
    enabled: open,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'unmapped'],
    queryFn: () => ticketsService.unmapped({ pageSize: 50 }),
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: (id: string) => ticketsService.linkUnmapped(id, selectedClient),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Chamado vinculado ao cliente', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível vincular',
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Chamados sem cliente mapeado"
      description="Chamados do Zoho cuja conta não corresponde a nenhum cliente. Selecione o cliente e vincule."
      footer={
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-3">
        <Select
          value={selectedClient}
          onChange={(event) => setSelectedClient(event.target.value)}
          placeholder="Vincular a… (escolha um cliente)"
          options={clientOptions}
        />

        {isLoading && <TableSkeleton rows={3} />}
        {isError && (
          <ErrorState
            message="Não foi possível carregar a fila."
            onRetry={() => void refetch()}
          />
        )}
        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhum chamado na fila"
            description="Todos os chamados sincronizados têm cliente mapeado."
          />
        )}

        {data && data.data.length > 0 && (
          <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Visto em</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[16rem] truncate">
                      {row.subject ?? '(sem assunto)'}
                    </TableCell>
                    <TableCell>
                      {row.accountName ?? row.accountId ?? '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(row.lastSeenAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!selectedClient || linkMutation.isPending}
                        onClick={() => linkMutation.mutate(row.id)}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Vincular
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Dialog>
  );
}
