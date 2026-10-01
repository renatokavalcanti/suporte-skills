import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Professional } from '@/types/entities';
import {
  professionalTypeLabels,
  roleLabels,
  seniorityLabels,
  formatDate,
} from '@/utils/labels';

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-800 dark:text-slate-200">
        {value}
      </span>
    </div>
  );
}

export function SummaryTab({ professional }: { professional: Professional }) {
  const stats = professional.stats;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Certificações"
          value={stats.certifications}
          tone="text-slate-900 dark:text-slate-100"
        />
        <StatCard label="Expirando" value={stats.expiring} tone="text-amber-600" />
        <StatCard label="Vencidas" value={stats.expired} tone="text-red-600" />
        <StatCard
          label="Roadmap aberto"
          value={stats.openRoadmap}
          tone="text-blue-600"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados cadastrais</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 dark:divide-slate-800">
          <InfoRow label="E-mail" value={professional.email} />
          <InfoRow label="Cargo" value={professional.position ?? '—'} />
          <InfoRow
            label="Tipo"
            value={
              professional.professionalType
                ? professionalTypeLabels[professional.professionalType]
                : '—'
            }
          />
          <InfoRow
            label="Senioridade"
            value={
              professional.seniority
                ? seniorityLabels[professional.seniority]
                : '—'
            }
          />
          <InfoRow label="Admissão" value={formatDate(professional.hireDate)} />
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              Papel de acesso
            </span>
            <Badge variant="info">{roleLabels[professional.role]}</Badge>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Situação</span>
            <Badge variant={professional.active ? 'success' : 'neutral'}>
              {professional.active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {professional.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
              {professional.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
