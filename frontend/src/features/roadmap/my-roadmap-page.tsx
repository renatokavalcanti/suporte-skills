import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/hooks/use-auth';
import { RoadmapTab } from '@/features/professionals/tabs/roadmap-tab';

/**
 * Visao do CONSULTANT (D-027): o proprio roadmap em destaque na navegacao,
 * onde ele registra os objetivos e anexa os comprovantes.
 */
export function MyRoadmapPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Meu roadmap"
        description="Registre seus objetivos de evolução e anexe os comprovantes em PDF."
      />
      <RoadmapTab professionalId={user.id} />
    </>
  );
}
