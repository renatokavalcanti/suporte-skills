import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { reportsService } from '@/services/reports.service';
import type { ConsultantReportItem } from '@/types/entities';
import {
  formatDate,
  roadmapPriorityLabels,
  roadmapPriorityVariant,
  roadmapStatusLabels,
  roadmapStatusVariant,
  roadmapTypeLabels,
} from '@/utils/labels';

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-semibold ${tone ?? 'text-slate-800 dark:text-slate-200'}`}>
        {value}
      </span>
    </span>
  );
}

function ConsultantModal({
  consultant,
  onClose,
}: {
  consultant: ConsultantReportItem | null;
  onClose: () => void;
}) {
  const { stats, items } = consultant ?? {
    stats: { total: 0, open: 0, completed: 0, cancelled: 0, overdue: 0 },
    items: [],
  };

  return (
    <Dialog
      open={Boolean(consultant)}
      onClose={onClose}
      title={consultant?.name ?? ''}
      description={
        consultant?.position
          ? `${consultant.position} · ${stats.total} item(ns) no roadmap`
          : `${stats.total} item(ns) no roadmap`
      }
      size="lg"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Stat label="Abertos" value={stats.open} />
        <Stat
          label="Atrasados"
          value={stats.overdue}
          tone={stats.overdue > 0 ? 'text-red-600 dark:text-red-400' : undefined}
        />
        <Stat label="Concluídos" value={stats.completed} />
        {stats.cancelled > 0 && <Stat label="Cancelados" value={stats.cancelled} />}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum item de roadmap"
          description="Este consultor ainda não cadastrou objetivos."
        />
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {item.technology ?? item.certification ?? '—'}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="neutral">{roadmapTypeLabels[item.type]}</Badge>
                  <Badge variant={roadmapPriorityVariant[item.priority]}>
                    {roadmapPriorityLabels[item.priority]}
                  </Badge>
                  <Badge variant={roadmapStatusVariant[item.status]}>
                    {roadmapStatusLabels[item.status]}
                  </Badge>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                {item.hasAttachment && <Paperclip className="h-3.5 w-3.5" />}
                <span>{formatDate(item.dueDate)}</span>
                {item.isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/**
 * Painel de consultores (D-028): um card por CONSULTANT ativo com contadores
 * rapidos; ao clicar, abre a janela flutuante com os itens do roadmap dele.
 */
export function ConsultantsPanel() {
  const [selected, setSelected] = useState<ConsultantReportItem | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'consultants'],
    queryFn: () => reportsService.consultants(),
  });

  if (isLoading) {
    return (
      <Card>
        <LoadingState label="Carregando consultores..." />
      </Card>
    );
  }
  if (isError || !data) {
    return (
      <Card>
        <ErrorState
          message="Não foi possível carregar os consultores."
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }
  if (data.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Nenhum consultor ativo"
          description="Cadastre consultores ativos para ver o painel."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((consultant) => (
          <button
            key={consultant.professionalId}
            type="button"
            onClick={() => setSelected(consultant)}
            className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {consultant.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {consultant.position ?? 'Consultor'}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Stat label="Abertos" value={consultant.stats.open} />
              <Stat
                label="Atrasados"
                value={consultant.stats.overdue}
                tone={
                  consultant.stats.overdue > 0
                    ? 'text-red-600 dark:text-red-400'
                    : undefined
                }
              />
              <Stat label="Total" value={consultant.stats.total} />
            </div>
          </button>
        ))}
      </div>

      <ConsultantModal consultant={selected} onClose={() => setSelected(null)} />
    </>
  );
}
