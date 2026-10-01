import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { professionalsService } from '@/services/professionals.service';
import { vendorsService } from '@/services/vendors.service';
import type { RoadmapListParams } from '@/services/roadmap.service';
import type { RoadmapItem } from '@/types/entities';
import {
  roadmapPriorityLabels,
  roadmapStatusLabels,
  toOptions,
} from '@/utils/labels';
import { RoadmapFormDialog } from './roadmap-form-dialog';
import { RoadmapListView } from './roadmap-list-view';
import { RoadmapKanbanView } from './roadmap-kanban-view';
import { RoadmapTimelineView } from './roadmap-timeline-view';
import { cn } from '@/lib/utils';

type View = 'lista' | 'kanban' | 'timeline';

const views: { value: View; label: string }[] = [
  { value: 'lista', label: 'Lista' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'timeline', label: 'Timeline' },
];

export function RoadmapPage() {
  const { canWrite } = usePermissions();
  const [view, setView] = useState<View>('lista');
  const [search, setSearch] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoadmapItem | null>(null);

  const { data: professionals } = useQuery({
    queryKey: ['professionals', 'options', 'active'],
    queryFn: () => professionalsService.list({ pageSize: 200, active: true, sort: 'name' }),
  });
  const { data: vendors } = useQuery({
    queryKey: ['vendors', 'options'],
    queryFn: () => vendorsService.list({ pageSize: 200, sort: 'name' }),
  });

  const filters = useMemo<RoadmapListParams>(
    () => ({
      search: debouncedSearch || undefined,
      professionalId: professionalId || undefined,
      vendorId: vendorId || undefined,
      priority: priority || undefined,
      status: status || undefined,
      overdue: overdue || undefined,
    }),
    [debouncedSearch, professionalId, vendorId, priority, status, overdue],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (item: RoadmapItem) => {
    setEditing(item);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Roadmap"
        description="Objetivos técnicos da equipe: lista, kanban e timeline."
        actions={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Novo item
            </Button>
          )
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar objetivo"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
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
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Select
              className="sm:w-48"
              placeholder="Todos os profissionais"
              value={professionalId}
              onChange={(event) => setProfessionalId(event.target.value)}
              options={(professionals?.data ?? []).map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
            <Select
              className="sm:w-44"
              placeholder="Todos os fabricantes"
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
              options={(vendors?.data ?? []).map((v) => ({
                value: v.id,
                label: v.name,
              }))}
            />
            <Select
              className="sm:w-40"
              placeholder="Todas as prioridades"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              options={toOptions(roadmapPriorityLabels)}
            />
            <Select
              className="sm:w-44"
              placeholder="Todos os status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={toOptions(roadmapStatusLabels)}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={overdue}
                onChange={(event) => setOverdue(event.target.checked)}
              />
              Somente atrasados
            </label>
          </div>
        </div>
      </Card>

      {view === 'lista' && (
        <RoadmapListView filters={filters} onEdit={openEdit} canWrite={canWrite} />
      )}
      {view === 'kanban' && (
        <RoadmapKanbanView filters={filters} onEdit={openEdit} canWrite={canWrite} />
      )}
      {view === 'timeline' && (
        <RoadmapTimelineView filters={filters} onEdit={openEdit} canWrite={canWrite} />
      )}

      <RoadmapFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
      />
    </>
  );
}
