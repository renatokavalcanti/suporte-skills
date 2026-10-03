import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { professionalsService } from '@/services/professionals.service';
import { extractApiError } from '@/services/api';
import { cn } from '@/lib/utils';
import type { RoadmapItem, RoadmapStatus } from '@/types/entities';
import { RoadmapFormDialog } from '@/features/roadmap/roadmap-form-dialog';
import { RoadmapKanbanView } from '@/features/roadmap/roadmap-kanban-view';
import { RoadmapTimelineView } from '@/features/roadmap/roadmap-timeline-view';
import { RoadmapAttachmentCell } from '../roadmap-attachment-cell';
import {
  formatDate,
  formatDaysRemaining,
  roadmapPriorityLabels,
  roadmapPriorityVariant,
  roadmapStatusLabels,
  roadmapStatusVariant,
  roadmapTypeLabels,
} from '@/utils/labels';

type View = 'lista' | 'kanban' | 'timeline';

const views: { value: View; label: string }[] = [
  { value: 'lista', label: 'Lista' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'timeline', label: 'Timeline' },
];

export function RoadmapTab({ professionalId }: { professionalId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEditProfessional } = usePermissions();
  // O CONSULTANT mantem o proprio roadmap; a gestao mantem o de qualquer um (D-026).
  const canWrite = canEditProfessional(professionalId);

  const [view, setView] = useState<View>('lista');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoadmapItem | null>(null);
  const [removing, setRemoving] = useState<RoadmapItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['professional', professionalId, 'roadmap'],
    queryFn: () => professionalsService.roadmap(professionalId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['professional', professionalId, 'roadmap'],
    });
    void queryClient.invalidateQueries({ queryKey: ['professional', professionalId] });
    void queryClient.invalidateQueries({ queryKey: ['roadmap'] });
  };

  const removeMutation = useMutation({
    mutationFn: (itemId: string) =>
      professionalsService.removeRoadmap(professionalId, itemId),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Item removido', variant: 'success' });
      setRemoving(null);
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível remover',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RoadmapStatus }) =>
      professionalsService.setRoadmapStatus(professionalId, id, status),
    onSuccess: () => invalidate(),
    onError: (error) =>
      toast({
        title: 'Não foi possível mover',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  return (
    <>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-md border border-slate-300 p-0.5 dark:border-slate-700">
          {views.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setView(option.value)}
              className={cn(
                'rounded px-3 py-1 text-sm font-medium',
                view === option.value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo objetivo
          </Button>
        )}
      </div>

      {isLoading && (
        <Card className="overflow-hidden">
          <TableSkeleton rows={4} />
        </Card>
      )}
      {isError && (
        <Card>
          <ErrorState
            message="Não foi possível carregar o roadmap."
            onRetry={() => void refetch()}
          />
        </Card>
      )}

      {data && view === 'lista' && (
        <Card className="overflow-hidden">
          {data.length === 0 ? (
            <EmptyState
              title="Nenhum objetivo de desenvolvimento"
              description="Crie o primeiro objetivo no roadmap deste profissional."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Restante</TableHead>
                  <TableHead>Anexo</TableHead>
                  {canWrite && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {item.technology?.name ?? item.certification?.name ?? ''}
                      </div>
                    </TableCell>
                    <TableCell>{roadmapTypeLabels[item.type]}</TableCell>
                    <TableCell>
                      <Badge variant={roadmapPriorityVariant[item.priority]}>
                        {roadmapPriorityLabels[item.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={roadmapStatusVariant[item.status]}>
                        {roadmapStatusLabels[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {formatDate(item.dueDate)}
                        {item.isOverdue && (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.status === 'COMPLETED' || item.status === 'CANCELLED'
                        ? '—'
                        : formatDaysRemaining(item.daysToDue)}
                    </TableCell>
                    <TableCell>
                      <RoadmapAttachmentCell
                        professionalId={professionalId}
                        item={item}
                        canWrite={canWrite}
                      />
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Editar"
                            onClick={() => {
                              setEditing(item);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remover"
                            onClick={() => setRemoving(item)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {data && view === 'kanban' && (
        <RoadmapKanbanView
          items={data}
          onEdit={(item) => {
            setEditing(item);
            setFormOpen(true);
          }}
          canWrite={canWrite}
          onMoveStatus={(id, status) => moveMutation.mutate({ id, status })}
        />
      )}

      {data && view === 'timeline' && (
        <RoadmapTimelineView
          items={data}
          onEdit={(item) => {
            setEditing(item);
            setFormOpen(true);
          }}
          canWrite={canWrite}
        />
      )}

      <RoadmapFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        defaultProfessionalId={professionalId}
        mode="profile"
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remover item do roadmap"
        description={
          removing
            ? `Remover "${removing.title}" do roadmap deste profissional?`
            : undefined
        }
        confirmLabel="Remover"
        destructive
        reversible={false}
        loading={removeMutation.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removeMutation.mutate(removing.id);
        }}
      />
    </>
  );
}
