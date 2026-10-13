import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Link2, Layers } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const checkboxClass =
  'h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600';

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
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const clientsQuery = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => clientsService.list({ pageSize: 100, active: true }),
    enabled: open,
  });

  const groupsQuery = useQuery({
    queryKey: ['tickets', 'unmapped', 'groups'],
    queryFn: () => ticketsService.unmappedGroups(),
    enabled: open,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'unmapped', page],
    queryFn: () => ticketsService.unmapped({ page, pageSize: 50 }),
    enabled: open,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    void queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  const bulkMutation = useMutation({
    mutationFn: (payload: { clientId: string; ids?: string[]; accountId?: string }) =>
      ticketsService.linkUnmappedBulk(payload),
    onSuccess: (result) => {
      setSelected(new Set());
      invalidate();
      toast({
        title: `${result.linked} chamado(s) vinculado(s)`,
        description: `${result.created} criado(s), ${result.updated} atualizado(s)${
          result.notFound ? `, ${result.notFound} não encontrado(s)` : ''
        }.`,
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível vincular',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const linkMutation = useMutation({
    mutationFn: (id: string) => ticketsService.linkUnmapped(id, selectedClient),
    onSuccess: (_result, id) => {
      setSelected((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      invalidate();
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

  const rows = data?.data ?? [];
  const pageIds = rows.map((row) => row.id);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const groups = groupsQuery.data ?? [];
  const busy = bulkMutation.isPending || linkMutation.isPending;

  const toggleRow = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Chamados sem cliente mapeado"
      description="Chamados do Zoho cuja conta não corresponde a nenhum cliente. Escolha o cliente de destino e vincule pela conta ou pelos selecionados."
      footer={
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Cliente de destino
          </label>
          <Select
            value={selectedClient}
            onChange={(event) => setSelectedClient(event.target.value)}
            placeholder="Vincular a… (escolha um cliente)"
            options={clientOptions}
          />
        </div>

        {groups.length > 0 && (
          <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Layers className="h-3.5 w-3.5" />
              Vincular por conta do Zoho
            </p>
            <ul className="space-y-1.5">
              {groups.map((group) => (
                <li
                  key={group.accountId ?? 'sem-conta'}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">
                    {group.accountName ?? group.accountId ?? '(sem conta)'}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="neutral">{group.count}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!selectedClient || busy}
                      onClick={() =>
                        bulkMutation.mutate({
                          clientId: selectedClient,
                          accountId: group.accountId ?? undefined,
                        })
                      }
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Vincular todos
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {selected.size > 0 && (
          <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm dark:bg-blue-950/40">
            <span className="text-blue-700 dark:text-blue-300">
              {selected.size} selecionado(s)
            </span>
            <Button
              size="sm"
              disabled={!selectedClient || busy}
              onClick={() =>
                bulkMutation.mutate({
                  clientId: selectedClient,
                  ids: [...selected],
                })
              }
            >
              <CheckCheck className="h-4 w-4" />
              Vincular selecionados
            </Button>
          </div>
        )}

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

        {rows.length > 0 && (
          <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      aria-label="Selecionar todos"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Visto em</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className={checkboxClass}
                        aria-label="Selecionar chamado"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                      />
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {row.subject ?? '(sem assunto)'}
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate">
                      {row.accountName ?? row.accountId ?? '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(row.lastSeenAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!selectedClient || busy}
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

        {data && data.meta.total > data.meta.pageSize && (
          <Pagination meta={data.meta} onPageChange={setPage} />
        )}
      </div>
    </Dialog>
  );
}
