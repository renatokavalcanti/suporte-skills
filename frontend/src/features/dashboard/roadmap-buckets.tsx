import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback';
import type { RoadmapBucket, RoadmapBuckets } from '@/types/entities';
import { formatDate, roadmapPriorityVariant } from '@/utils/labels';

function BucketCard({
  title,
  tone,
  bucket,
  showOverdue,
}: {
  title: string;
  tone: string;
  bucket: RoadmapBucket;
  showOverdue?: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <span className={`text-lg font-semibold ${tone}`}>{bucket.count}</span>
      </CardHeader>
      <CardContent className="pt-1">
        {bucket.items.length === 0 ? (
          <p className="py-3 text-xs text-slate-400">Nada por aqui.</p>
        ) : (
          <ul className="space-y-2">
            {bucket.items.map((item) => (
              <li key={item.id} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {item.title}
                  </span>
                  {showOverdue && item.isOverdue && (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />
                  )}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-slate-400">
                    {item.professionalName}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-slate-400">
                    {formatDate(item.dueDate)}
                    <Badge variant={roadmapPriorityVariant[item.priority]}>
                      {item.priority}
                    </Badge>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RoadmapBucketsPanel({ buckets }: { buckets: RoadmapBuckets }) {
  const hasAny =
    buckets.overdue.count +
      buckets.next30.count +
      buckets.days31to90.count +
      buckets.next6Months.count ===
    0;

  if (hasAny) {
    return (
      <Card>
        <EmptyState
          title="Sem objetivos abertos"
          description="Nenhum item de roadmap com prazo definido."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <BucketCard
        title="Atrasados"
        tone="text-red-600"
        bucket={buckets.overdue}
        showOverdue
      />
      <BucketCard title="Próximos 30 dias" tone="text-amber-600" bucket={buckets.next30} />
      <BucketCard
        title="31 a 90 dias"
        tone="text-slate-900 dark:text-slate-100"
        bucket={buckets.days31to90}
      />
      <BucketCard
        title="Próximos 6 meses"
        tone="text-slate-900 dark:text-slate-100"
        bucket={buckets.next6Months}
      />
    </div>
  );
}
