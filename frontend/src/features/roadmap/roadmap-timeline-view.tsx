import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { roadmapService, type RoadmapListParams } from '@/services/roadmap.service';
import type { RoadmapItem, RoadmapStatus } from '@/types/entities';
import {
  formatDate,
  roadmapPriorityLabels,
  roadmapPriorityVariant,
  roadmapStatusLabels,
  roadmapStatusOrder,
} from '@/utils/labels';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PADDING_DAYS = 14;

const barColor: Record<RoadmapStatus, string> = {
  BACKLOG: 'bg-slate-400',
  PLANNED: 'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-red-400',
};

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function RoadmapTimelineView({
  filters,
  items,
  onEdit,
  canWrite,
}: {
  filters?: RoadmapListParams;
  /** Quando informado, usa estes itens (ex.: roadmap do proprio consultor) em
   *  vez de buscar no board global. */
  items?: RoadmapItem[];
  onEdit: (item: RoadmapItem) => void;
  canWrite: boolean;
}) {
  const controlled = items !== undefined;
  const { data: fetched, isLoading, isError, refetch } = useQuery({
    queryKey: ['roadmap', 'timeline', filters ?? {}],
    queryFn: () => roadmapService.timeline(filters ?? {}),
    enabled: !controlled,
  });
  const data = controlled ? items : fetched;

  const { ranged, withoutDates, min, totalDays, months } = useMemo(() => {
    const items = data ?? [];
    const rangedItems = items.filter((item) => item.startDate || item.dueDate);
    const dateless = items.filter((item) => !item.startDate && !item.dueDate);

    if (rangedItems.length === 0) {
      return {
        ranged: [] as RoadmapItem[],
        withoutDates: dateless,
        min: new Date(),
        totalDays: 1,
        months: [] as Date[],
      };
    }

    let minTime = Number.POSITIVE_INFINITY;
    let maxTime = Number.NEGATIVE_INFINITY;
    for (const item of rangedItems) {
      const start = toDate(item.startDate) ?? toDate(item.dueDate);
      const end = toDate(item.dueDate) ?? toDate(item.startDate);
      if (start) minTime = Math.min(minTime, start.getTime());
      if (end) maxTime = Math.max(maxTime, end.getTime());
    }

    const minDate = new Date(minTime - PADDING_DAYS * MS_PER_DAY);
    const maxDate = new Date(maxTime + PADDING_DAYS * MS_PER_DAY);
    const span = Math.max(1, (maxDate.getTime() - minDate.getTime()) / MS_PER_DAY);

    const monthList: Date[] = [];
    let cursor = startOfMonth(minDate);
    while (cursor.getTime() < maxDate.getTime()) {
      monthList.push(cursor);
      cursor = addMonths(cursor, 1);
    }

    const sorted = [...rangedItems].sort((a, b) => {
      const aStart = toDate(a.startDate) ?? toDate(a.dueDate);
      const bStart = toDate(b.startDate) ?? toDate(b.dueDate);
      return (aStart?.getTime() ?? 0) - (bStart?.getTime() ?? 0);
    });

    return { ranged: sorted, withoutDates: dateless, min: minDate, totalDays: span, months: monthList };
  }, [data]);

  if (!controlled && isLoading) {
    return (
      <Card>
        <LoadingState label="Carregando linha do tempo..." />
      </Card>
    );
  }
  if (!controlled && isError) {
    return (
      <Card>
        <ErrorState
          message="Não foi possível carregar a linha do tempo."
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }
  if (!data || data.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhum item de roadmap"
          description="Ajuste os filtros ou crie um novo objetivo."
        />
      </Card>
    );
  }

  const pct = (time: number): number =>
    Math.min(100, Math.max(0, ((time - min.getTime()) / MS_PER_DAY / totalDays) * 100));

  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto">
        <div className="min-w-[640px] p-4">
          {/* Cabeçalho de meses */}
          <div className="relative mb-2 ml-56 h-6 border-b border-slate-200 dark:border-slate-800">
            {months.map((month) => (
              <span
                key={month.toISOString()}
                className="absolute top-0 text-xs text-slate-400"
                style={{ left: `${pct(month.getTime())}%` }}
              >
                {month.toLocaleDateString('pt-BR', {
                  month: 'short',
                  year: '2-digit',
                  timeZone: 'UTC',
                })}
              </span>
            ))}
          </div>

          <div className="space-y-1.5">
            {ranged.map((item) => {
              const start = toDate(item.startDate) ?? toDate(item.dueDate)!;
              const end = toDate(item.dueDate) ?? toDate(item.startDate)!;
              const left = pct(start.getTime());
              const right = pct(end.getTime());
              const width = Math.max(1.5, right - left);
              return (
                <div key={item.id} className="flex items-center">
                  <div className="w-56 shrink-0 pr-3">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.professional.name}
                    </p>
                  </div>
                  <div className="relative h-7 flex-1">
                    <div
                      className={`absolute top-1.5 h-4 rounded-full ${barColor[item.status]} ${
                        item.isOverdue ? 'ring-2 ring-red-500' : ''
                      }`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${formatDate(item.startDate)} → ${formatDate(item.dueDate)}`}
                    />
                  </div>
                  <div className="w-40 shrink-0 pl-3 text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(item.dueDate)}
                    </span>
                  </div>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => onEdit(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        {roadmapStatusOrder.map((status) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${barColor[status]}`} />
            {roadmapStatusLabels[status]}
          </span>
        ))}
      </div>

      {withoutDates.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Itens sem datas ({withoutDates.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {withoutDates.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-800"
              >
                {item.title}
                <Badge variant={roadmapPriorityVariant[item.priority]}>
                  {roadmapPriorityLabels[item.priority]}
                </Badge>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
