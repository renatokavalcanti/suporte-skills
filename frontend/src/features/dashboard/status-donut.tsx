import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { CertificationStatus } from '@/types/entities';
import { certificationStatusLabels } from '@/utils/labels';

const segments: { key: CertificationStatus; color: string }[] = [
  { key: 'ACTIVE', color: '#10b981' },
  { key: 'EXPIRING', color: '#f59e0b' },
  { key: 'EXPIRED', color: '#ef4444' },
  { key: 'NO_EXPIRATION', color: '#3b82f6' },
];

export function StatusDonut({
  distribution,
}: {
  distribution: Record<CertificationStatus, number>;
}) {
  const total = segments.reduce((sum, segment) => sum + distribution[segment.key], 0);

  let acc = 0;
  const stops = segments
    .map((segment) => {
      const from = total === 0 ? 0 : (acc / total) * 360;
      acc += distribution[segment.key];
      const to = total === 0 ? 0 : (acc / total) * 360;
      return `${segment.color} ${from}deg ${to}deg`;
    })
    .join(', ');

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Status das certificações</CardTitle>
        <CardDescription>Distribuição considerando toda a equipe.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <div
          role="img"
          aria-label={`Distribuição das certificações: ${segments
            .map(
              (segment) =>
                `${certificationStatusLabels[segment.key]} ${distribution[segment.key]}`,
            )
            .join(', ')}`}
          className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
          style={{
            background:
              total === 0
                ? 'conic-gradient(#e2e8f0 0deg 360deg)'
                : `conic-gradient(${stops})`,
          }}
        >
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white dark:bg-slate-900">
            <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {total}
            </span>
            <span className="text-[10px] text-slate-400">registros</span>
          </div>
        </div>

        <ul className="flex-1 space-y-2">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                {certificationStatusLabels[segment.key]}
              </span>
              <Badge variant="neutral">{distribution[segment.key]}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
