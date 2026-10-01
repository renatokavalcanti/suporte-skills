import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/feedback';
import { dashboardService } from '@/services/dashboard.service';
import { KpiCards } from './kpi-cards';
import { StatusDonut } from './status-donut';
import { UpcomingExpirations } from './upcoming-expirations';
import { RoadmapBucketsPanel } from './roadmap-buckets';
import { AlertsList } from './alerts-list';
import { CoverageList } from './coverage-list';

function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full lg:col-span-2" />
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.get(),
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral da capacidade técnica da equipe."
      />

      {isLoading && <DashboardSkeleton />}

      {isError && (
        <Card>
          <ErrorState
            message="Não foi possível carregar o dashboard."
            onRetry={() => void refetch()}
          />
        </Card>
      )}

      {data && (
        <div className="space-y-3">
          <KpiCards cards={data.cards} />

          <div className="grid gap-3 lg:grid-cols-3">
            <StatusDonut distribution={data.certificationStatus} />
            <div className="lg:col-span-2">
              <UpcomingExpirations items={data.upcomingExpirations} />
            </div>
          </div>

          <RoadmapBucketsPanel buckets={data.roadmap} />

          <div className="grid gap-3 lg:grid-cols-2">
            <AlertsList alerts={data.alerts} />
            <CoverageList coverage={data.coverage} />
          </div>

          <p className="text-right text-xs text-slate-400">
            Atualizado em{' '}
            {new Date(data.generatedAt).toLocaleString('pt-BR')} · limiar de
            vencimento: {data.expiringThresholdDays} dias
          </p>
        </div>
      )}
    </>
  );
}
