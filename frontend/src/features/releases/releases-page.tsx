import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { releasesService } from '@/services/releases.service';
import { extractApiError } from '@/services/api';
import type { Release, ReleaseCategory } from '@/types/entities';
import { cn } from '@/lib/utils';
import {
  formatDate,
  releaseCategoryLabels,
  releaseCategoryVariant,
} from '@/utils/labels';
import { ReleaseFormDialog } from './release-form-dialog';

const CATEGORY_ORDER: ReleaseCategory[] = [
  'FEATURE',
  'IMPROVEMENT',
  'FIX',
  'SECURITY',
  'INFRA',
  'OTHER',
];

export function ReleasesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canWrite } = usePermissions();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Release | null>(null);
  const [removing, setRemoving] = useState<Release | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['releases', { pageSize: 50 }],
    queryFn: () => releasesService.list({ pageSize: 50 }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['releases'] });

  const currentMutation = useMutation({
    mutationFn: (id: string) => releasesService.setCurrent(id),
    onSuccess: () => {
      void invalidate();
      toast({ title: 'Versão atual atualizada', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível atualizar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => releasesService.remove(id),
    onSuccess: () => {
      void invalidate();
      toast({ title: 'Release removida', variant: 'success' });
      setRemoving(null);
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível remover',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  return (
    <>
      <PageHeader
        title="Releases"
        description="Histórico de versões e mudanças do sistema."
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova release
            </Button>
          )
        }
      />

      {isLoading && <LoadingState label="Carregando releases..." />}
      {isError && (
        <ErrorState
          message="Não foi possível carregar as releases."
          onRetry={() => void refetch()}
        />
      )}

      {data && data.data.length === 0 && (
        <Card>
          <EmptyState
            title="Nenhuma release cadastrada"
            description="Cadastre a primeira versão para começar o histórico."
          />
        </Card>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-4">
          {data.data.map((release) => (
            <ReleaseCard
              key={release.id}
              release={release}
              canWrite={canWrite}
              onEdit={() => {
                setEditing(release);
                setFormOpen(true);
              }}
              onSetCurrent={() => currentMutation.mutate(release.id)}
              onRemove={() => setRemoving(release)}
            />
          ))}
        </div>
      )}

      <ReleaseFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        release={editing}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remover release"
        description={
          removing
            ? `Remover a versão ${removing.version}? Ela deixa de aparecer no histórico.`
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

function ReleaseCard({
  release,
  canWrite,
  onEdit,
  onSetCurrent,
  onRemove,
}: {
  release: Release;
  canWrite: boolean;
  onEdit: () => void;
  onSetCurrent: () => void;
  onRemove: () => void;
}) {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: release.items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <Card className={cn('p-5', release.current && 'border-l-4 border-l-blue-500')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
            {release.version}
          </span>
          {release.current && (
            <Badge variant="success">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Versão atual
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {formatDate(release.releasedAt)}
          </span>
          {canWrite && (
            <div className="flex items-center gap-1">
              {!release.current && (
                <Button variant="ghost" size="sm" onClick={onSetCurrent}>
                  Tornar atual
                </Button>
              )}
              <Button variant="ghost" size="icon" aria-label="Editar" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover"
                onClick={onRemove}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
        {release.title}
      </h3>
      {release.summary && (
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          {release.summary}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {groups.map((group) => (
          <div key={group.category}>
            <Badge variant={releaseCategoryVariant[group.category]}>
              {releaseCategoryLabels[group.category]}
            </Badge>
            <ul className="mt-1.5 space-y-1 pl-1">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  {item.description}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
