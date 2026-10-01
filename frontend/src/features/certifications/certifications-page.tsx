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
import { certificationsService } from '@/services/certifications.service';
import { vendorsService } from '@/services/vendors.service';
import { extractApiError } from '@/services/api';
import type { Certification } from '@/types/entities';
import { CertificationFormDialog } from './certification-form-dialog';
import {
  catalogStatusLabels,
  catalogStatusVariant,
  certificationLevelLabels,
  toOptions,
} from '@/utils/labels';

export function CertificationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = usePermissions();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Certification | null>(null);
  const [deactivating, setDeactivating] = useState<Certification | null>(null);

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
      level: levelFilter || undefined,
      catalogStatus: catalogFilter || undefined,
    }),
    [page, debouncedSearch, vendorFilter, levelFilter, catalogFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['certifications', params],
    queryFn: () => certificationsService.list(params),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      certificationsService.setActive(id, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['certifications'] });
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
        title="Certificações"
        description="Catálogo de certificações e vínculos com profissionais."
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova certificação
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou código"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            className="lg:w-44"
            placeholder="Todos os fabricantes"
            value={vendorFilter}
            onChange={(event) => {
              setVendorFilter(event.target.value);
              setPage(1);
            }}
            options={vendorOptions}
          />
          <Select
            className="lg:w-40"
            placeholder="Todos os níveis"
            value={levelFilter}
            onChange={(event) => {
              setLevelFilter(event.target.value);
              setPage(1);
            }}
            options={toOptions(certificationLevelLabels)}
          />
          <Select
            className="lg:w-44"
            placeholder="Todo o catálogo"
            value={catalogFilter}
            onChange={(event) => {
              setCatalogFilter(event.target.value);
              setPage(1);
            }}
            options={toOptions(catalogStatusLabels)}
          />
        </div>

        {isLoading && <TableSkeleton rows={6} />}
        {isError && (
          <ErrorState
            message="Não foi possível carregar as certificações."
            onRetry={() => void refetch()}
          />
        )}
        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhuma certificação encontrada"
            description="Ajuste os filtros ou cadastre uma nova certificação."
          />
        )}

        {data && data.data.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certificação</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Tecnologia</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Catálogo</TableHead>
                  <TableHead>Profissionais</TableHead>
                  <TableHead>Situação</TableHead>
                  {canWrite && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((certification) => (
                  <TableRow key={certification.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {certification.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {certification.code && <span>{certification.code}</span>}
                        {certification.officialUrl && (
                          <a
                            href={certification.officialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                          >
                            site oficial
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{certification.vendor.name}</TableCell>
                    <TableCell>
                      {certification.technology?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      {certification.level
                        ? certificationLevelLabels[certification.level]
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {certification.validityMonths
                        ? `${certification.validityMonths} meses`
                        : 'Sem validade'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={catalogStatusVariant[certification.catalogStatus]}
                      >
                        {catalogStatusLabels[certification.catalogStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {certification._count.professionalCertifications}
                    </TableCell>
                    <TableCell>
                      <Badge variant={certification.active ? 'success' : 'neutral'}>
                        {certification.active ? 'Ativa' : 'Inativa'}
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
                              setEditing(certification);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {certification.active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Desativar"
                              onClick={() => setDeactivating(certification)}
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
                                  id: certification.id,
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

      <CertificationFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        certification={editing}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Desativar certificação"
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
