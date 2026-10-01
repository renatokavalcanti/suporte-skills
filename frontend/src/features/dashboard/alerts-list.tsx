import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AlertItem } from '@/types/entities';

const iconBySeverity = {
  danger: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toneBySeverity = {
  danger: 'text-red-500 bg-red-50 dark:bg-red-950/40',
  warning: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
  info: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40',
};

export function AlertsList({ alerts }: { alerts: AlertItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Alertas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Nenhum ponto de atenção no momento.
          </div>
        ) : (
          alerts.map((alert) => {
            const Icon = iconBySeverity[alert.severity];
            return (
              <div
                key={alert.type}
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneBySeverity[alert.severity]}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {alert.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {alert.description}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-500">
                  {alert.count}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
