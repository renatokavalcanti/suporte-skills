import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power, PowerOff, RefreshCw } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
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
import { newsSourcesService } from '@/services/news.service';
import { vendorsService } from '@/services/vendors.service';
import { extractApiError } from '@/services/api';
import type { NewsSource } from '@/types/entities';
import {
  formatDateTime,
  newsConnectorLabels,
  toOptions,
} from '@/utils/labels';

const schema = z
  .object({
    vendorId: z.string().min(1, 'Selecione o fabricante'),
    name: z.string().min(1, 'Informe o nome da fonte'),
    url: z.string().optional(),
    connectorType: z.string(),
    active: z.boolean().optional(),
    fetchIntervalMinutes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.connectorType !== 'MANUAL') {
      const url = (values.url ?? '').trim();
      if (!url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['url'],
          message: 'Informe a URL do feed',
        });
      } else if (!/^https?:\/\//i.test(url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['url'],
          message: 'A URL deve começar com http(s)://',
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

function SourceFormDialog({
  open,
  onClose,
  source,
}: {
  open: boolean;
  onClose: () => void;
  source?: NewsSource | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(source);

  const { data: vendors } = useQuery({
    queryKey: ['vendors', 'options'],
    queryFn: () => vendorsService.list({ pageSize: 200, sort: 'name' }),
    enabled: open,
  });
  const vendorOptions = useMemo(
    () => (vendors?.data ?? []).map((v) => ({ value: v.id, label: v.name })),
    [vendors],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vendorId: '',
      name: '',
      url: '',
      connectorType: 'RSS',
      active: true,
      fetchIntervalMinutes: '',
    },
  });

  const connectorType = watch('connectorType');

  useEffect(() => {
    if (!open) return;
    reset(
      source
        ? {
            vendorId: source.vendorId,
            name: source.name,
            url: source.url ?? '',
            connectorType: source.connectorType,
            active: source.active,
            fetchIntervalMinutes:
              source.fetchIntervalMinutes != null
                ? String(source.fetchIntervalMinutes)
                : '',
          }
        : {
            vendorId: '',
            name: '',
            url: '',
            connectorType: 'RSS',
            active: true,
            fetchIntervalMinutes: '',
          },
    );
  }, [open, source, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const interval = values.fetchIntervalMinutes?.trim();
      const payload = {
        vendorId: values.vendorId,
        name: values.name.trim(),
        url: values.connectorType === 'MANUAL' ? null : values.url?.trim() || null,
        connectorType: values.connectorType,
        active: values.active ?? true,
        fetchIntervalMinutes: interval ? Number(interval) : null,
      };
      return source
        ? newsSourcesService.update(source.id, payload)
        : newsSourcesService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['news-sources'] });
      toast({
        title: isEditing ? 'Fonte atualizada' : 'Fonte cadastrada',
        variant: 'success',
      });
      onClose();
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível salvar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableClose={mutation.isPending}
      title={isEditing ? 'Editar fonte' : 'Nova fonte'}
      description="Feed oficial (RSS/Atom) monitorado periodicamente."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit((values) => mutation.mutate(values))}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Spinner className="h-4 w-4 text-white" />}
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="sf-vendor">Fabricante *</Label>
          <Select
            id="sf-vendor"
            placeholder="Selecione"
            options={vendorOptions}
            {...register('vendorId')}
          />
          {errors.vendorId && (
            <p role="alert" className="text-xs text-red-600">
              {errors.vendorId.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sf-name">Nome *</Label>
          <Input id="sf-name" {...register('name')} />
          {errors.name && (
            <p role="alert" className="text-xs text-red-600">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sf-type">Tipo</Label>
          <Select
            id="sf-type"
            options={toOptions(newsConnectorLabels)}
            {...register('connectorType')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sf-active">Situação</Label>
          <Select
            id="sf-active"
            options={[
              { value: 'true', label: 'Ativa' },
              { value: 'false', label: 'Inativa' },
            ]}
            {...register('active', {
              setValueAs: (value) => value === 'true' || value === true,
            })}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sf-url">URL do feed{connectorType !== 'MANUAL' ? ' *' : ''}</Label>
          <Input
            id="sf-url"
            placeholder="https://.../feed"
            disabled={connectorType === 'MANUAL'}
            {...register('url')}
          />
          {errors.url && (
            <p role="alert" className="text-xs text-red-600">
              {errors.url.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sf-interval">Intervalo (min)</Label>
          <Input
            id="sf-interval"
            type="number"
            min={5}
            placeholder="Padrão do sistema"
            {...register('fetchIntervalMinutes')}
          />
        </div>
      </form>
    </Dialog>
  );
}

export function NewsSourcesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NewsSource | null>(null);
  const [deactivating, setDeactivating] = useState<NewsSource | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['news-sources'],
    queryFn: () => newsSourcesService.list({ pageSize: 100 }),
    enabled: open,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['news-sources'] });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      newsSourcesService.setActive(id, active),
    onSuccess: () => {
      void invalidate();
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

  const syncMutation = useMutation({
    mutationFn: (id: string) => newsSourcesService.sync(id),
    onSuccess: (result) => {
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ['news'] });
      toast({
        title: 'Fonte sincronizada',
        description: `${result.created} nova(s), ${result.updated} atualizada(s).`,
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Falha ao sincronizar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        title="Fontes do Tec News"
        description="Canais oficiais monitorados. Fontes automáticas são lidas por RSS/Atom."
        footer={
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        }
      >
        <div className="mb-4 flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nova fonte
          </Button>
        </div>

        {isLoading && <TableSkeleton rows={5} />}
        {isError && (
          <ErrorState
            message="Não foi possível carregar as fontes."
            onRetry={() => void refetch()}
          />
        )}
        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhuma fonte cadastrada"
            description="Cadastre o feed oficial de um fabricante para começar."
          />
        )}

        {data && data.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Última sync</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {source.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {source.vendor.name}
                    </div>
                    {source.lastStatus === 'ERROR' && source.lastError && (
                      <div className="max-w-xs truncate text-xs text-red-600">
                        {source.lastError}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{newsConnectorLabels[source.connectorType]}</TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(source.lastFetchedAt)}
                    </div>
                    <Badge
                      variant={
                        source.lastStatus === 'OK'
                          ? 'success'
                          : source.lastStatus === 'ERROR'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {source.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>{source._count.items}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Sincronizar"
                        disabled={source.connectorType === 'MANUAL' || syncMutation.isPending}
                        onClick={() => syncMutation.mutate(source.id)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar"
                        onClick={() => {
                          setEditing(source);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {source.active ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Desativar"
                          onClick={() => setDeactivating(source)}
                        >
                          <PowerOff className="h-4 w-4 text-red-500" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Ativar"
                          onClick={() =>
                            toggleMutation.mutate({ id: source.id, active: true })
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
        )}
      </Dialog>

      <SourceFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        source={editing}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Desativar fonte"
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
