import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  type BadgeProps,
} from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { professionalsService } from '@/services/professionals.service';
import type { AuditAction, AuditLogEntry } from '@/types/entities';
import { formatDateTime } from '@/utils/labels';

const actionLabels: Record<AuditAction, string> = {
  CREATE: 'Criação',
  UPDATE: 'Atualização',
  DELETE: 'Remoção',
};

const actionVariant: Record<AuditAction, BadgeProps['variant']> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
};

const entityLabels: Record<string, string> = {
  professionals: 'Perfil',
  professional_certifications: 'Certificação',
  roadmap_items: 'Roadmap',
};

function describe(entry: AuditLogEntry): string {
  const entity = entityLabels[entry.entity] ?? entry.entity;
  const after = entry.after ?? {};
  const detail =
    typeof after['certificationId'] === 'string'
      ? ` (certificação ${after['certificationId']})`
      : '';
  return `${entity} · ${actionLabels[entry.action]}${detail}`;
}

export function HistoryTab({ professionalId }: { professionalId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['professional', professionalId, 'history'],
    queryFn: () => professionalsService.history(professionalId),
  });

  if (isLoading) return <LoadingState label="Carregando histórico..." />;
  if (isError) {
    return (
      <ErrorState
        message="Não foi possível carregar o histórico."
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data || data.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Sem histórico"
          description="Alterações relevantes aparecerão aqui."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 p-4">
              <Badge variant={actionVariant[entry.action]}>
                {actionLabels[entry.action]}
              </Badge>
              <div className="flex-1">
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  {describe(entry)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(entry.createdAt)}
                  {entry.actor ? ` · por ${entry.actor.name}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
