import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import {
  EmptyState,
  ErrorState,
  TableSkeleton,
} from '@/components/feedback';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { professionalsService } from '@/services/professionals.service';
import { extractApiError } from '@/services/api';
import type { Professional } from '@/types/entities';
import { ProfessionalFormDialog } from './professional-form-dialog';
import { roleLabels, seniorityLabels, toOptions } from '@/utils/labels';

export function ProfessionalsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = usePermissions();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [deactivating, setDeactivating] = useState<Professional | null>(null);

  const params = useMemo(
    () => ({
      page,
      pageSize: 10,
      search: debouncedSearch || undefined,
      active: activeFilter === '' ? undefined : activeFilter === 'true',
      role: roleFilter || undefined,
    }),
    [page, debouncedSearch, activeFilter, roleFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['professionals', params],
    queryFn: () => professionalsService.list(params),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      professionalsService.setActive(id, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['professionals'] });
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

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (professional: Professional) => {
    setEditing(professional);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Equipe, certificações e objetivos de desenvolvimento."
        actions={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Novo profissional
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, e-mail ou cargo"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="sm:w-40"
            placeholder="Todas as situações"
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value);
              setPage(1);
            }}
            options={[
              { value: 'true', label: 'Ativos' },
              { value: 'false', label: 'Inativos' },
            ]}
          />
          <Select
            className="sm:w-44"
            placeholder="Todos os papéis"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(1);
            }}
            options={toOptions(roleLabels)}
          />
        </div>

        {isLoading && <TableSkeleton rows={6} />}

        {isError && (
          <ErrorState
            message="Não foi possível carregar os profissionais."
            onRetry={() => void refetch()}
          />
        )}

        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhum profissional encontrado"
            description="Ajuste os filtros ou cadastre um novo profissional."
          />
        )}

        {data && data.data.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Certificações</TableHead>
                  <TableHead>Expirando</TableHead>
                  <TableHead>Vencidas</TableHead>
                  <TableHead>Roadmap</TableHead>
                  <TableHead>Situação</TableHead>
                  {canWrite && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((professional) => (
                  <TableRow key={professional.id}>
                    <TableCell>
                      <Link
                        to={`/profissionais/${professional.id}`}
                        className="font-medium text-slate-900 hover:text-blue-700 hover:underline dark:text-slate-100 dark:hover:text-blue-400"
                      >
                        {professional.name}
                      </Link>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {professional.email}
                      </div>
                      {professional.mustChangePassword && (
                        <Badge variant="warning" className="mt-1">
                          Senha provisória
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-slate-700 dark:text-slate-300">
                        {professional.position ?? '—'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {professional.seniority
                          ? seniorityLabels[professional.seniority]
                          : ''}
                      </div>
                    </TableCell>
                    <TableCell>{professional.stats.certifications}</TableCell>
                    <TableCell>
                      {professional.stats.expiring > 0 ? (
                        <Badge variant="warning">
                          {professional.stats.expiring}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {professional.stats.expired > 0 ? (
                        <Badge variant="danger">
                          {professional.stats.expired}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell>{professional.stats.openRoadmap}</TableCell>
                    <TableCell>
                      <Badge variant={professional.active ? 'success' : 'neutral'}>
                        {professional.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar"
                            onClick={() => openEdit(professional)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {professional.active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Desativar"
                              onClick={() => setDeactivating(professional)}
                            >
                              <PowerOff className="h-4 w-4 text-red-500" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Ativar"
                              onClick={() =>
                                toggleMutation.mutate({
                                  id: professional.id,
                                  active: true,
                                })
                              }
                            >
                              <Power className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination meta={data.meta} onPageChange={setPage} />
          </>
        )}
      </Card>

      <ProfessionalFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        professional={editing}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Desativar profissional"
        description={
          deactivating
            ? `Desativar ${deactivating.name}? Certificações e roadmap são preservados.`
            : undefined
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
