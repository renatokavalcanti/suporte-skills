import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback';

export function UnderConstruction({
  phase,
  description,
}: {
  phase: string;
  description?: string;
}) {
  return (
    <Card>
      <EmptyState
        title={`Módulo previsto para a ${phase}`}
        description={
          description ??
          'A Fase 1 (fundação) entregou layout, autenticação, banco e seed. Este módulo será implementado nas próximas fases.'
        }
      />
    </Card>
  );
}
