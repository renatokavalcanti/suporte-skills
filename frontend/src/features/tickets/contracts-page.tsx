import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, Pencil, Power, Trash2 } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { extractApiError } from '@/services/api';
import { clientsService } from '@/services/clients.service';
import { contractsService } from '@/services/contracts.service';
import { ContractFormDialog } from './contract-form-dialog';
import type { Contract } from '@/types/reports';

function minutesLabel(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function brl(value: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value),
  );
}

export function ContractsPage() {
  const { canWrite } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [clientId, setClientId] = useState('');
  const [active, setActive] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [removing, setRemoving] = useState<Contract | null>(null);

  const clientsQuery = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => clientsService.list({ pageSize: 100 }),
  });

  const params = useMemo(
    () => ({
      page,
      pageSize: 12,
      clientId: clientId || undefined,
      active: active === '' ? undefined : active === 'true',
    }),
    [page, clientId, active],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contracts', 'list', params],
    queryFn: () => contractsService.list(params),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['contracts'] });

  const toggleStatus = useMutation({
    mutationFn: (contract: Contract) =>
      contractsService.setActive(contract.id, !contract.active),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Situação atualizada', variant: 'success' });
    },
    onError: (error) =>
      toast({ title: 'Não foi possível atualizar', description: extractApiError(error), variant: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (contract: Contract) => contractsService.remove(contract.id),
    onSuccess: () => {
      invalidate();
      setRemoving(null);
      toast({ title: 'Contrato desativado', variant: 'success' });
    },
    onError: (error) =>
      toast({ title: 'Não foi possível desativar', description: extractApiError(error), variant: 'error' }),
  });

  const clientOptions =
    clientsQuery.data?.data.map((client) => ({
      value: client.id,
      label: client.name,
    })) ?? [];

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Franquia, valores e política de saldo por cliente — base do faturamento."
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <FilePlus2 className="h-4 w-4" />
              Novo contrato
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
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(1);
            }}
            options={clientOptions}
          />
          <Select
            className="sm:w-40"
            placeholder="Todas as situações"
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'true', label: 'Ativos' },
              { value: 'false', label: 'Inativos' },
            ]}
          />
        </div>

        {isLoading && <TableSkeleton rows={6} />}
        {isError && (
          <ErrorState message="Não foi possível carregar os contratos." onRetry={() => void refetch()} />
        )}
        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhum contrato cadastrado"
            description="Cadastre um contrato para habilitar o faturamento por cliente."
          />
        )}

        {data && data.data.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Franquia</TableHead>
                  <TableHead className="text-right">Mensal</TableHead>
                  <TableHead className="text-right">Hora adic.</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                      {contract.client.name}
                    </TableCell>
                    <TableCell>{contract.planName}</TableCell>
                    <TableCell className="text-right">
                      {minutesLabel(contract.includedMinutes)}
                    </TableCell>
                    <TableCell className="text-right">{brl(contract.monthlyValue)}</TableCell>
                    <TableCell className="text-right">{brl(contract.extraHourValue)}</TableCell>
                    <TableCell>
                      {contract.balancePolicy === 'ACCUMULATE' ? 'Acumula' : 'Expira'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={contract.active ? 'success' : 'neutral'}>
                        {contract.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(contract);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatus.mutate(contract)}
                          title={contract.active ? 'Desativar' : 'Ativar'}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemoving(contract)}
                          title="Desativar"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
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

      <ContractFormDialog
        open={formOpen}
        contract={editing}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Desativar contrato"
        description={removing ? `${removing.client.name} — ${removing.planName}` : undefined}
        confirmLabel="Desativar"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}
