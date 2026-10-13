import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, PowerOff, Search } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { clientsService } from '@/services/clients.service';
import { extractApiError } from '@/services/api';
import type { Client } from '@/types/tickets';
import { ClientFormDialog } from './client-form-dialog';

const activeOptions = [
  { value: 'true', label: 'Ativos' },
  { value: 'false', label: 'Inativos' },
];

export function ClientsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deactivating, setDeactivating] = useState<Client | null>(null);

  const params = useMemo(
    () => ({
      page,
      pageSize: 10,
      search: debouncedSearch || undefined,
      active: activeFilter === '' ? undefined : activeFilter === 'true',
    }),
    [page, debouncedSearch, activeFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['clients', params],
    queryFn: () => clientsService.list(params),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      clientsService.setActive(id, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Situação atualizada', variant: 'success' });
      setDeactivating(null);
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível atualizar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Clientes usados nas Medições Mensais de faturamento."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, documento ou conta Zoho"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="sm:w-44"
            placeholder="Todas as situações"
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value);
              setPage(1);
            }}
            options={activeOptions}
          />
        </div>

        {isLoading && <TableSkeleton rows={6} />}
        {isError && (
          <ErrorState
            message="Não foi possível carregar os clientes."
            onRetry={() => void refetch()}
          />
        )}
        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhum cliente encontrado"
            description="Ajuste os filtros ou cadastre um novo cliente."
          />
        )}

        {data && data.data.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ/NIF</TableHead>
                  <TableHead>Conta Zoho</TableHead>
                  <TableHead>Chamados</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                      {client.name}
                    </TableCell>
                    <TableCell>{client.document ?? '—'}</TableCell>
                    <TableCell>{client.zohoAccountId ?? '—'}</TableCell>
                    <TableCell>{client._count.tickets}</TableCell>
                    <TableCell>
                      <Badge variant={client.active ? 'success' : 'neutral'}>
                        {client.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar"
                          onClick={() => {
                            setEditing(client);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {client.active ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Desativar"
                            onClick={() => setDeactivating(client)}
                          >
                            <PowerOff className="h-4 w-4 text-red-500" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Ativar"
                            onClick={() =>
                              toggleMutation.mutate({ id: client.id, active: true })
                            }
                          >
                            <Power className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      <ClientFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        client={editing}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Desativar cliente"
        description={
          deactivating ? `Desativar ${deactivating.name}?` : undefined
        }
        confirmLabel="Desativar"
        destructive
        loading={toggleMutation.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={() => {
          if (deactivating) {
            toggleMutation.mutate({ id: deactivating.id, active: false });
          }
        }}
      />
    </>
  );
}
