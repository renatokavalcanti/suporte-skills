import { useQuery } from '@tanstack/react-query';
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
import { CertificationStatusBadge } from '@/components/certification-status-badge';
import { professionalsService } from '@/services/professionals.service';
import { technologyCategoryLabels } from '@/utils/labels';

export function TechnologiesTab({ professionalId }: { professionalId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['professional', professionalId, 'technologies'],
    queryFn: () => professionalsService.technologies(professionalId),
  });

  return (
    <Card className="overflow-hidden">
      {isLoading && <TableSkeleton rows={4} />}
      {isError && (
        <ErrorState
          message="Não foi possível carregar as tecnologias."
          onRetry={() => void refetch()}
        />
      )}
      {data && data.length === 0 && (
        <EmptyState
          title="Nenhuma tecnologia relacionada"
          description="As tecnologias aparecem a partir das certificações vinculadas."
        />
      )}

      {data && data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tecnologia</TableHead>
              <TableHead>Fabricante</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Certificações</TableHead>
              <TableHead>Melhor status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.technologyId ?? item.name}>
                <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                  {item.name}
                </TableCell>
                <TableCell>{item.vendorName ?? '—'}</TableCell>
                <TableCell>
                  {item.category
                    ? technologyCategoryLabels[item.category]
                    : '—'}
                </TableCell>
                <TableCell>{item.certifications}</TableCell>
                <TableCell>
                  <CertificationStatusBadge status={item.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
