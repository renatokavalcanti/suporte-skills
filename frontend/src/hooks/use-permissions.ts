import { useAuth } from './use-auth';
import type { ProfessionalRole } from '@/types/entities';

export function usePermissions() {
  const { user } = useAuth();
  const role: ProfessionalRole | undefined = user?.role;
  const isManager = role === 'ADMIN' || role === 'MANAGER';

  return {
    role,
    canWrite: isManager,
    isAdmin: role === 'ADMIN',
    /**
     * Edicao dos dados vinculados a um profissional (certificacoes, etc.).
     * ADMIN/MANAGER editam qualquer um; CONSULTANT apenas o proprio perfil
     * (D-019). O backend aplica a mesma regra.
     */
    canEditProfessional: (professionalId?: string): boolean =>
      isManager || (role === 'CONSULTANT' && !!professionalId && professionalId === user?.id),
  };
}
