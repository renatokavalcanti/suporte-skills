import {
  Award,
  CalendarClock,
  CalendarX2,
  ListChecks,
  TimerOff,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { DashboardCards } from '@/types/entities';

const items = [
  { key: 'professionals', label: 'Profissionais ativos', icon: Users, tone: 'text-slate-900 dark:text-slate-100' },
  { key: 'certificationsAssigned', label: 'Certificações atribuídas', icon: Award, tone: 'text-blue-600' },
  { key: 'expiring', label: 'Vencendo (90 dias)', icon: CalendarClock, tone: 'text-amber-600' },
  { key: 'expired', label: 'Vencidas', icon: CalendarX2, tone: 'text-red-600' },
  { key: 'openRoadmap', label: 'Roadmaps abertos', icon: ListChecks, tone: 'text-slate-900 dark:text-slate-100' },
  { key: 'overdueRoadmap', label: 'Roadmaps atrasados', icon: TimerOff, tone: 'text-red-600' },
] as const;

export function KpiCards({ cards }: { cards: DashboardCards }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key}>
            <CardContent className="flex items-start justify-between gap-2 p-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.label}
                </p>
                <p className={`mt-1 text-2xl font-semibold ${item.tone}`}>
                  {cards[item.key]}
                </p>
              </div>
              <Icon className="h-4 w-4 text-slate-300 dark:text-slate-600" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
