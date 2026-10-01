import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { roadmapService, type RoadmapListParams } from '@/services/roadmap.service';
import type { RoadmapItem } from '@/types/entities';
import {
  formatDate,
  roadmapPriorityLabels,
  roadmapPriorityVariant,
  roadmapStatusLabels,
  roadmapStatusVariant,
  roadmapTypeLabels,
} from '@/utils/labels';

export function RoadmapListView({
  filters,
  onEdit,
  canWrite,
}: {
  filters: RoadmapListParams;
  onEdit: (item: RoadmapItem) => void;
  canWrite: boolean;
}) {
  const [page, setPage] = useState(1);

  // Volta para a primeira pagina quando os filtros mudam (evita pagina vazia).
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['roadmap', 'list', filters, page],
    queryFn: () => roadmapService.list({ ...filters, page, pageSize: 10 }),
  });

  if (isLoading) {
    return (
      <Card>
        <TableSkeleton rows={6} />
      </Card>
    );
  }
  if (isError) {
    return (
      <Card>
        <ErrorState
          message="Não foi possível carregar o roadmap."
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }
  if (!data || data.data.length === 0) {
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
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Objetivo</TableHead>
            <TableHead>Fabricante</TableHead>
            <TableHead>Tecnologia</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Prazo</TableHead>
            {canWrite && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {item.title}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {item.professional.name}
                  {item.certification ? ` · ${item.certification.name}` : ''}
                </div>
              </TableCell>
              <TableCell>
                {item.technology?.vendor.name ??
                  item.certification?.vendor.name ??
                  '—'}
              </TableCell>
              <TableCell>{item.technology?.name ?? '—'}</TableCell>
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
              <TableCell>{formatDate(item.startDate)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {formatDate(item.dueDate)}
                  {item.isOverdue && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  )}
                </div>
              </TableCell>
              {canWrite && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar"
                    onClick={() => onEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination meta={data.meta} onPageChange={setPage} />
    </Card>
  );
}
