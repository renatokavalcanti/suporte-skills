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
import { usePermissions } from '@/hooks/use-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { technologiesService } from '@/services/technologies.service';
import { vendorsService } from '@/services/vendors.service';
import { extractApiError } from '@/services/api';
import type { Technology } from '@/types/entities';
import { TechnologyFormDialog } from './technology-form-dialog';
import { technologyCategoryLabels, toOptions } from '@/utils/labels';

export function TechnologiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = usePermissions();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Technology | null>(null);
  const [deactivating, setDeactivating] = useState<Technology | null>(null);

  const { data: vendors } = useQuery({
    queryKey: ['vendors', 'options'],
    queryFn: () => vendorsService.list({ pageSize: 200, sort: 'name' }),
  });

  const vendorOptions = useMemo(
    () => (vendors?.data ?? []).map((v) => ({ value: v.id, label: v.name })),
    [vendors],
  );

  const params = useMemo(
    () => ({
      page,
      pageSize: 10,
      search: debouncedSearch || undefined,
      vendorId: vendorFilter || undefined,
      category: categoryFilter || undefined,
    }),
    [page, debouncedSearch, vendorFilter, categoryFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['technologies', params],
    queryFn: () => technologiesService.list(params),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      technologiesService.setActive(id, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['technologies'] });
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
        title="Tecnologias"
        description="Produtos e plataformas por fabricante."
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova tecnologia
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
              placeholder="Buscar tecnologia"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="sm:w-48"
            placeholder="Todos os fabricantes"
            value={vendorFilter}
            onChange={(event) => {
              setVendorFilter(event.target.value);
              setPage(1);
            }}
            options={vendorOptions}
          />
          <Select
            className="sm:w-52"
            placeholder="Todas as categorias"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
            options={toOptions(technologyCategoryLabels)}
          />
        </div>

        {isLoading && <TableSkeleton rows={6} />}
        {isError && (
          <ErrorState
            message="Não foi possível carregar as tecnologias."
            onRetry={() => void refetch()}
          />
        )}
        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhuma tecnologia encontrada"
            description="Ajuste os filtros ou cadastre uma nova tecnologia."
          />
        )}

        {data && data.data.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tecnologia</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Certificações</TableHead>
                  <TableHead>Situação</TableHead>
                  {canWrite && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((technology) => (
                  <TableRow key={technology.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {technology.name}
                      </div>
                      {technology.description && (
                        <div className="max-w-md truncate text-xs text-slate-500 dark:text-slate-400">
                          {technology.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{technology.vendor.name}</TableCell>
                    <TableCell>
                      {technology.category
                        ? technologyCategoryLabels[technology.category]
                        : '—'}
                    </TableCell>
                    <TableCell>{technology._count.certifications}</TableCell>
                    <TableCell>
                      <Badge variant={technology.active ? 'success' : 'neutral'}>
                        {technology.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar"
                            onClick={() => {
                              setEditing(technology);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {technology.active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Desativar"
                              onClick={() => setDeactivating(technology)}
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
                                  id: technology.id,
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

      <TechnologyFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        technology={editing}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Desativar tecnologia"
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
