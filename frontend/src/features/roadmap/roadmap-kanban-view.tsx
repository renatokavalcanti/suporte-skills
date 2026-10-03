import { useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, GripVertical, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { useToast } from '@/components/toast';
import { roadmapService, type RoadmapListParams } from '@/services/roadmap.service';
import { extractApiError } from '@/services/api';
import type { RoadmapItem, RoadmapStatus } from '@/types/entities';
import {
  formatDate,
  roadmapPriorityLabels,
  roadmapPriorityVariant,
  roadmapStatusLabels,
  roadmapStatusOrder,
  roadmapTypeLabels,
} from '@/utils/labels';

function KanbanCard({
  item,
  onEdit,
  canWrite,
}: {
  item: RoadmapItem;
  onEdit: (item: RoadmapItem) => void;
  canWrite: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !canWrite,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
        isDragging ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5">
          {canWrite && (
            <button
              className="mt-0.5 cursor-grab text-slate-400 hover:text-slate-600"
              aria-label="Arrastar"
              {...listeners}
              {...attributes}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {item.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {item.professional.name}
            </p>
          </div>
        </div>
        {canWrite && (
          <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => onEdit(item)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={roadmapPriorityVariant[item.priority]}>
          {roadmapPriorityLabels[item.priority]}
        </Badge>
        <Badge variant="neutral">{roadmapTypeLabels[item.type]}</Badge>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          {item.technology?.name ?? item.certification?.vendor.name ?? ''}
        </span>
        <span className="flex items-center gap-1">
          {formatDate(item.dueDate)}
          {item.isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  items,
  onEdit,
  canWrite,
}: {
  status: RoadmapStatus;
  items: RoadmapItem[];
  onEdit: (item: RoadmapItem) => void;
  canWrite: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-slate-50 dark:bg-slate-900/50 ${
        isOver
          ? 'border-blue-400 bg-blue-50/60 dark:border-blue-600'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {roadmapStatusLabels[status]}
        </span>
        <span className="rounded-full bg-slate-200 px-2 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {items.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {items.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-slate-400">
            Nenhum item
          </p>
        )}
        {items.map((item) => (
          <KanbanCard key={item.id} item={item} onEdit={onEdit} canWrite={canWrite} />
        ))}
      </div>
    </div>
  );
}

export function RoadmapKanbanView({
  filters,
  items,
  onEdit,
  canWrite,
  onMoveStatus,
}: {
  filters?: RoadmapListParams;
  /** Quando informado, usa estes itens (ex.: roadmap do proprio consultor) em
   *  vez de buscar no board global. */
  items?: RoadmapItem[];
  onEdit: (item: RoadmapItem) => void;
  canWrite: boolean;
  /** Callback de movimento para o modo controlado; no modo normal grava pelo board. */
  onMoveStatus?: (id: string, status: RoadmapStatus) => void;
}) {
  const controlled = items !== undefined;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const queryKey = useMemo(() => ['roadmap', 'kanban', filters ?? {}], [filters]);

  const { data: fetched, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => roadmapService.kanban(filters ?? {}),
    enabled: !controlled,
  });

  const data = useMemo<Record<RoadmapStatus, RoadmapItem[]> | undefined>(() => {
    if (controlled && items) {
      const grouped = Object.fromEntries(
        roadmapStatusOrder.map((status) => [status, [] as RoadmapItem[]]),
      ) as Record<RoadmapStatus, RoadmapItem[]>;
      for (const item of items) grouped[item.status].push(item);
      return grouped;
    }
    return fetched;
  }, [controlled, items, fetched]);

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RoadmapStatus }) =>
      roadmapService.setStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<Record<RoadmapStatus, RoadmapItem[]>>(queryKey);
      if (previous) {
        const next = { ...previous };
        let moved: RoadmapItem | undefined;
        for (const key of roadmapStatusOrder) {
          const found = next[key].find((item) => item.id === id);
          if (found) {
            moved = { ...found, status };
            next[key] = next[key].filter((item) => item.id !== id);
          }
        }
        if (moved) {
          next[status] = [...next[status], moved];
          queryClient.setQueryData(queryKey, next);
        }
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast({
        title: 'Não foi possível mover',
        description: extractApiError(error),
        variant: 'error',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['roadmap'] });
    },
  });

  const onDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over) return;
    const itemId = String(active.id);
    const targetStatus = String(over.id) as RoadmapStatus;
    if (!roadmapStatusOrder.includes(targetStatus)) return;

    const current = data
      ? roadmapStatusOrder
          .flatMap((status) => data[status])
          .find((item) => item.id === itemId)
      : undefined;

    if (!current || current.status === targetStatus) return;
    if (onMoveStatus) onMoveStatus(itemId, targetStatus);
    else moveMutation.mutate({ id: itemId, status: targetStatus });
  };

  if (!controlled && isLoading) {
    return (
      <Card>
        <LoadingState label="Carregando quadro..." />
      </Card>
    );
  }
  if (!controlled && (isError || !data)) {
    return (
      <Card>
        <ErrorState
          message="Não foi possível carregar o quadro."
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }
  if (!data) return null;

  const total = roadmapStatusOrder.reduce((sum, status) => sum + data[status].length, 0);
  if (total === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhum item de roadmap"
          description="Ajuste os filtros ou crie um novo objetivo."
        />
      </Card>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {roadmapStatusOrder.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={data[status]}
            onEdit={onEdit}
            canWrite={canWrite}
          />
        ))}
      </div>
    </DndContext>
  );
}
