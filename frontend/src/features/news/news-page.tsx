import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Circle,
  ExternalLink,
  FilterX,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Rss,
  Search,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { newsService } from '@/services/news.service';
import { vendorsService } from '@/services/vendors.service';
import { technologiesService } from '@/services/technologies.service';
import { extractApiError } from '@/services/api';
import type { NewsItem } from '@/types/entities';
import { cn } from '@/lib/utils';
import {
  formatDate,
  newsKindLabels,
  newsKindVariant,
  toOptions,
} from '@/utils/labels';
import { NewsFormDialog } from './news-form-dialog';
import { NewsSourcesDialog } from './news-sources-dialog';

type Scope = 'all' | 'unread' | 'saved' | 'pinned';

export function NewsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = usePermissions();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [technologyFilter, setTechnologyFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const debouncedSearch = useDebouncedValue(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [removing, setRemoving] = useState<NewsItem | null>(null);

  const { data: vendors } = useQuery({
    queryKey: ['vendors', 'options'],
    queryFn: () => vendorsService.list({ pageSize: 200, sort: 'name' }),
  });
  const { data: technologies } = useQuery({
    queryKey: ['technologies', 'options'],
    queryFn: () => technologiesService.list({ pageSize: 200, sort: 'name' }),
  });

  const vendorOptions = useMemo(
    () => (vendors?.data ?? []).map((v) => ({ value: v.id, label: v.name })),
    [vendors],
  );
  const technologyOptions = useMemo(
    () =>
      (technologies?.data ?? []).map((t) => ({
        value: t.id,
        label: `${t.name} — ${t.vendor.name}`,
      })),
    [technologies],
  );

  const { data: summary } = useQuery({
    queryKey: ['news', 'summary'],
    queryFn: () => newsService.summary(),
  });

  const params = useMemo(
    () => ({
      page,
      pageSize: 10,
      search: debouncedSearch || undefined,
      vendorId: vendorFilter || undefined,
      technologyId: technologyFilter || undefined,
      kind: kindFilter || undefined,
      unread: scope === 'unread' || undefined,
      saved: scope === 'saved' || undefined,
      pinned: scope === 'pinned' || undefined,
    }),
    [page, debouncedSearch, vendorFilter, technologyFilter, kindFilter, scope],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['news', params],
    queryFn: () => newsService.list(params),
  });

  const invalidateNews = () =>
    queryClient.invalidateQueries({ queryKey: ['news'] });

  const readMutation = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      newsService.setRead(id, read),
    onSuccess: () => void invalidateNews(),
    onError: (error) =>
      toast({
        title: 'Não foi possível atualizar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const savedMutation = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) =>
      newsService.setSaved(id, saved),
    onSuccess: () => void invalidateNews(),
    onError: (error) =>
      toast({
        title: 'Não foi possível atualizar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      newsService.setPinned(id, pinned),
    onSuccess: () => void invalidateNews(),
    onError: (error) =>
      toast({
        title: 'Não foi possível atualizar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => newsService.remove(id),
    onSuccess: () => {
      void invalidateNews();
      toast({ title: 'Novidade removida', variant: 'success' });
      setRemoving(null);
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível remover',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const syncMutation = useMutation({
    mutationFn: () => newsService.syncAll(),
    onSuccess: (result) => {
      void invalidateNews();
      void queryClient.invalidateQueries({ queryKey: ['news-sources'] });
      toast({
        title: 'Sincronização concluída',
        description: `${result.created} nova(s), ${result.updated} atualizada(s)${
          result.errors.length ? `, ${result.errors.length} falha(s)` : ''
        }.`,
        variant: result.errors.length ? 'info' : 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Falha na sincronização',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const hasFilters =
    Boolean(debouncedSearch) ||
    Boolean(vendorFilter) ||
    Boolean(technologyFilter) ||
    Boolean(kindFilter) ||
    scope !== 'all';

  const clearFilters = () => {
    setSearch('');
    setVendorFilter('');
    setTechnologyFilter('');
    setKindFilter('');
    setScope('all');
    setPage(1);
  };

  const scopes: { key: Scope; label: string; count?: number }[] = [
    { key: 'all', label: 'Todas', count: summary?.total },
    { key: 'unread', label: 'Não lidas', count: summary?.unread },
    { key: 'saved', label: 'Salvas', count: summary?.saved },
    { key: 'pinned', label: 'Destaques', count: summary?.pinned },
  ];

  return (
    <>
      <PageHeader
        title="Tec News"
        description="Novidades dos canais oficiais das tecnologias que estudamos."
        actions={
          canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw
                  className={cn('h-4 w-4', syncMutation.isPending && 'animate-spin')}
                />
                Sincronizar
              </Button>
              <Button variant="outline" onClick={() => setSourcesOpen(true)}>
                <Rss className="h-4 w-4" />
                Fontes
              </Button>
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Nova novidade
              </Button>
            </div>
          )
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {scopes.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setScope(item.key);
                  setPage(1);
                }}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  scope === item.key
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                {item.label}
                {typeof item.count === 'number' && (
                  <span className="ml-1 text-slate-400">({item.count})</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar novidade"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              className="sm:w-44"
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
              placeholder="Todas as tecnologias"
              value={technologyFilter}
              onChange={(event) => {
                setTechnologyFilter(event.target.value);
                setPage(1);
              }}
              options={technologyOptions}
            />
            <Select
              className="sm:w-44"
              placeholder="Todos os tipos"
              value={kindFilter}
              onChange={(event) => {
                setKindFilter(event.target.value);
                setPage(1);
              }}
              options={toOptions(newsKindLabels)}
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <FilterX className="h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {isLoading && <LoadingState label="Carregando novidades..." />}
      {isError && (
        <ErrorState
          message="Não foi possível carregar as novidades."
          onRetry={() => void refetch()}
        />
      )}

      {data && data.data.length === 0 && (
        <Card>
          <EmptyState
            title="Nenhuma novidade encontrada"
            description={
              hasFilters
                ? 'Ajuste os filtros para ver mais resultados.'
                : 'Cadastre uma fonte e sincronize para trazer as novidades oficiais.'
            }
          />
        </Card>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-3">
          {data.data.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              canWrite={canWrite}
              onToggleRead={() =>
                readMutation.mutate({ id: item.id, read: !item.read })
              }
              onToggleSaved={() =>
                savedMutation.mutate({ id: item.id, saved: !item.saved })
              }
              onTogglePinned={() =>
                pinMutation.mutate({ id: item.id, pinned: !item.pinned })
              }
              onEdit={() => {
                setEditing(item);
                setFormOpen(true);
              }}
              onRemove={() => setRemoving(item)}
            />
          ))}
          <Pagination meta={data.meta} onPageChange={setPage} />
        </div>
      )}

      <NewsFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
      />

      <NewsSourcesDialog
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remover novidade"
        description={
          removing
            ? `Remover "${removing.title}"? A novidade deixa de aparecer na lista.`
            : undefined
        }
        confirmLabel="Remover"
        destructive
        loading={removeMutation.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removeMutation.mutate(removing.id);
        }}
      />
    </>
  );
}

function NewsCard({
  item,
  canWrite,
  onToggleRead,
  onToggleSaved,
  onTogglePinned,
  onEdit,
  onRemove,
}: {
  item: NewsItem;
  canWrite: boolean;
  onToggleRead: () => void;
  onToggleSaved: () => void;
  onTogglePinned: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <Card
      className={cn(
        'p-4 transition-colors',
        !item.read && 'border-l-4 border-l-blue-500',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={newsKindVariant[item.kind]}>
            {newsKindLabels[item.kind]}
          </Badge>
          {item.vendor && <Badge variant="neutral">{item.vendor.name}</Badge>}
          {item.technology && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {item.technology.name}
            </span>
          )}
          {item.pinned && (
            <Badge variant="warning">
              <Pin className="mr-1 h-3 w-3" />
              Destaque
            </Badge>
          )}
        </div>
        <span className="shrink-0 text-xs text-slate-400">
          {formatDate(item.publishedAt ?? item.createdAt)}
        </span>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline dark:text-slate-100 dark:hover:text-blue-300"
      >
        {item.title}
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </a>

      {item.summary && (
        <p className="mt-1 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">
          {item.summary}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          {item.source?.name ?? (item.origin === 'manual' ? 'Curadoria' : 'Fonte')}
          {item.author ? ` · ${item.author}` : ''}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleRead}
            aria-label={item.read ? 'Marcar como não lida' : 'Marcar como lida'}
          >
            {item.read ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
            {item.read ? 'Lida' : 'Não lida'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSaved}
            aria-label={item.saved ? 'Remover dos salvos' : 'Salvar'}
          >
            {item.saved ? (
              <BookmarkCheck className="h-4 w-4 text-blue-600" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
          {canWrite && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={onTogglePinned}
                aria-label={item.pinned ? 'Desafixar' : 'Fixar como destaque'}
              >
                {item.pinned ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRemove}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
