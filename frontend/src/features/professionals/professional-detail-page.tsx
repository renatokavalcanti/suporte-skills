import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { ErrorState, LoadingState } from '@/components/feedback';
import { usePermissions } from '@/hooks/use-permissions';
import { professionalsService } from '@/services/professionals.service';
import { roleLabels, seniorityLabels } from '@/utils/labels';
import { ProfessionalFormDialog } from './professional-form-dialog';
import { SummaryTab } from './tabs/summary-tab';
import { CertificationsTab } from './tabs/certifications-tab';
import { RoadmapTab } from './tabs/roadmap-tab';
import { TechnologiesTab } from './tabs/technologies-tab';
import { HistoryTab } from './tabs/history-tab';

export function ProfessionalDetailPage() {
  const { id = '' } = useParams();
  const { canWrite } = usePermissions();
  const [tab, setTab] = useState('resumo');
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['professional', id],
    queryFn: () => professionalsService.get(id),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <Card>
        <LoadingState label="Carregando profissional..." />
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <ErrorState
          error={error}
          message="Não foi possível carregar o profissional."
          onRetry={() => void refetch()}
        />
      </Card>
    );
  }

  return (
    <>
      <Link
        to="/profissionais"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Profissionais
      </Link>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {data.name}
            </h1>
            <Badge variant={data.active ? 'success' : 'neutral'}>
              {data.active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {data.position ?? 'Sem cargo'}
            {data.seniority ? ` · ${seniorityLabels[data.seniority]}` : ''} ·{' '}
            {roleLabels[data.role]}
          </p>
        </div>
        {canWrite && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        )}
      </div>

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'resumo', label: 'Resumo' },
            {
              value: 'certificacoes',
              label: 'Certificações',
              count: data.stats.certifications,
            },
            { value: 'roadmap', label: 'Roadmap', count: data.stats.openRoadmap },
            { value: 'tecnologias', label: 'Tecnologias' },
            { value: 'historico', label: 'Histórico' },
          ]}
        />
      </div>

      {tab === 'resumo' && <SummaryTab professional={data} />}
      {tab === 'certificacoes' && <CertificationsTab professionalId={data.id} />}
      {tab === 'roadmap' && <RoadmapTab professionalId={data.id} />}
      {tab === 'tecnologias' && <TechnologiesTab professionalId={data.id} />}
      {tab === 'historico' && <HistoryTab professionalId={data.id} />}

      <ProfessionalFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        professional={data}
      />
    </>
  );
}
