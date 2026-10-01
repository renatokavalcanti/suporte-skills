import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/feedback';
import { usePermissions } from '@/hooks/use-permissions';
import type { ProfessionalRole } from '@/types/entities';

/**
 * Guarda de papel no frontend: evita que um usuario abra por URL direta uma
 * area restrita e veja apenas erros 403 da API. A autorizacao real continua
 * no backend (guards) - aqui e apenas experiencia de uso.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: ProfessionalRole[];
  children: ReactNode;
}) {
  const { role } = usePermissions();

  if (!role || !roles.includes(role)) {
    return (
      <Card>
        <EmptyState
          title="Acesso restrito"
          description="Seu perfil não tem permissão para acessar esta área."
        />
      </Card>
    );
  }

  return <>{children}</>;
}
