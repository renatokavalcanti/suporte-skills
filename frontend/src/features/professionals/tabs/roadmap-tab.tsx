import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Pencil, Plus } from 'lucide-react';
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
import { usePermissions } from '@/hooks/use-permissions';
import { professionalsService } from '@/services/professionals.service';
import type { RoadmapItem } from '@/types/entities';
import { RoadmapFormDialog } from '@/features/roadmap/roadmap-form-dialog';
import {
  formatDate,
  formatDaysRemaining,
  roadmapPriorityLabels,
  roadmapPriorityVariant,
  roadmapStatusLabels,
  roadmapStatusVariant,
  roadmapTypeLabels,
} from '@/utils/labels';

export function RoadmapTab({ professionalId }: { professionalId: string }) {
  const { canWrite } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoadmapItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['professional', professionalId, 'roadmap'],
    queryFn: () => professionalsService.roadmap(professionalId),
  });

  return (
    <>
      {canWrite && (
        <div className="mb-3 flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo objetivo
          </Button>
        </div>
      )}

      <Card className="overflow-hidden">
        {isLoading && <TableSkeleton rows={4} />}
        {isError && (
          <ErrorState
            message="Não foi possível carregar o roadmap."
            onRetry={() => void refetch()}
          />
        )}
        {data && data.length === 0 && (
          <EmptyState
            title="Nenhum objetivo de desenvolvimento"
            description="Crie o primeiro objetivo no roadmap deste profissional."
          />
        )}

        {data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Objetivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Restante</TableHead>
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
                  {canWrite && (
                    <TableCell className="text-right">
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
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <RoadmapFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        defaultProfessionalId={professionalId}
      />
    </>
  );
}
