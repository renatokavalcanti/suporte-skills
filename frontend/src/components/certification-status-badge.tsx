import { Badge } from '@/components/ui/badge';
import type { CertificationStatus } from '@/types/entities';
import {
  certificationStatusLabels,
  certificationStatusVariant,
} from '@/utils/labels';

export function CertificationStatusBadge({
  status,
}: {
  status: CertificationStatus;
}) {
  return (
    <Badge variant={certificationStatusVariant[status]}>
      {certificationStatusLabels[status]}
    </Badge>
  );
}
