import { Badge } from '@/components/ui/badge';
import { APP_ENVIRONMENT, ENVIRONMENT_META } from '@/config/environment';

/**
 * Selo do ambiente atual (PRD/HML/DEV) — D-038. Cor por ambiente para evitar
 * que alguém confunda as instâncias.
 */
export function EnvironmentBadge({
  withDescription = false,
}: {
  withDescription?: boolean;
}) {
  const meta = ENVIRONMENT_META[APP_ENVIRONMENT];
  return (
    <Badge
      variant={meta.badge}
      title={`Ambiente: ${meta.label} — ${meta.description}`}
    >
      {withDescription ? `${meta.label} · ${meta.description}` : meta.label}
    </Badge>
  );
}
