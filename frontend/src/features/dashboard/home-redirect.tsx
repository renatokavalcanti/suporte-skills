import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { DashboardPage } from '@/features/dashboard/dashboard-page';

/**
 * O dashboard e uma visao de gestao (ADMIN/MANAGER). O CONSULTANT e
 * direcionado ao proprio roadmap (D-027), que e o que ele mantem.
 */
export function HomeRedirect() {
  const { user } = useAuth();

  if (user && user.role === 'CONSULTANT') {
    return <Navigate to="/meu-roadmap" replace />;
  }

  return <DashboardPage />;
}
