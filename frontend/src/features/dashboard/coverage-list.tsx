import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/feedback';
import type { CoverageItem } from '@/types/entities';

function barColor(coverage: number): string {
  if (coverage <= 0) return 'bg-red-400';
  if (coverage < 34) return 'bg-amber-400';
  if (coverage < 67) return 'bg-blue-500';
  return 'bg-emerald-500';
}

export function CoverageList({ coverage }: { coverage: CoverageItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Cobertura tecnológica</CardTitle>
        <CardDescription>
          Profissionais ativos com certificação em vigor por tecnologia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {coverage.length === 0 ? (
          <EmptyState title="Nenhuma tecnologia ativa" />
        ) : (
          coverage.map((item) => (
            <div key={item.technologyId}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {item.technologyName}
                  <span className="ml-1 font-normal text-slate-400">
                    · {item.vendorName}
                  </span>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {item.coveredProfessionals}/{item.totalProfessionals} ({item.coverage}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${barColor(item.coverage)}`}
                  style={{ width: `${Math.max(item.coverage, item.coverage > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
