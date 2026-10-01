import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react';
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
import { vendorsService } from '@/services/vendors.service';
import { extractApiError } from '@/services/api';
import type { Vendor } from '@/types/entities';
import { VendorFormDialog } from './vendor-form-dialog';
import {
  formatDate,
  partnershipStatusLabels,
  partnershipStatusVariant,
  toOptions,
} from '@/utils/labels';

export function VendorsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = usePermissions();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deactivating, setDeactivating] = useState<Vendor | null>(null);

  const params = useMemo(
    () => ({
      page,
      pageSize: 10,
      search: debouncedSearch || undefined,
      partnershipStatus: statusFilter || undefined,
    }),
    [page, debouncedSearch, statusFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vendors', params],
    queryFn: () => vendorsService.list(params),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      vendorsService.setActive(id, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
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
        title="Fabricantes"
        description="Parceiros tecnológicos, níveis e datas de parceria."
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo fabricante
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
              placeholder="Buscar fabricante"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="sm:w-52"
            placeholder="Todas as parcerias"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            options={toOptions(partnershipStatusLabels)}
          />
        </div>

        {isLoading && <TableSkeleton rows={6} />}
        {isError && (
          <ErrorState
            message="Não foi possível carregar os fabricantes."
            onRetry={() => void refetch()}
          />
        )}
        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhum fabricante encontrado"
            description="Ajuste os filtros ou cadastre um novo fabricante."
          />
        )}

        {data && data.data.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Parceria</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Tecnologias</TableHead>
                  <TableHead>Certificações</TableHead>
                  <TableHead>Renovação</TableHead>
                  <TableHead>Situação</TableHead>
                  {canWrite && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {vendor.name}
                      </div>
                      {vendor.website && (
                        <a
                          href={vendor.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {vendor.website.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          partnershipStatusVariant[vendor.partnershipStatus]
                        }
                      >
                        {partnershipStatusLabels[vendor.partnershipStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>{vendor.partnershipLevel ?? '—'}</TableCell>
                    <TableCell>{vendor._count.technologies}</TableCell>
                    <TableCell>{vendor._count.certifications}</TableCell>
                    <TableCell>
                      {formatDate(vendor.partnershipRenewalDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={vendor.active ? 'success' : 'neutral'}>
                        {vendor.active ? 'Ativo' : 'Inativo'}
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
                              setEditing(vendor);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {vendor.active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Desativar"
                              onClick={() => setDeactivating(vendor)}
                            >
                              <PowerOff className="h-4 w-4 text-red-500" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Ativar"
                              onClick={() =>
                                toggleMutation.mutate({ id: vendor.id, active: true })
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

      <VendorFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        vendor={editing}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Desativar fabricante"
        description={deactivating ? `Desativar ${deactivating.name}?` : undefined}
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
