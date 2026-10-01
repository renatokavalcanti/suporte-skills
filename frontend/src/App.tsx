import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { RequireRole } from '@/components/require-role';
import { AppShell } from '@/layouts/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { HomeRedirect } from '@/features/dashboard/home-redirect';
import { ProfessionalsPage } from '@/features/professionals/professionals-page';
import { ProfessionalDetailPage } from '@/features/professionals/professional-detail-page';
import { VendorsPage } from '@/features/vendors/vendors-page';
import { TechnologiesPage } from '@/features/technologies/technologies-page';
import { CertificationsPage } from '@/features/certifications/certifications-page';
import { NewsPage } from '@/features/news/news-page';
import { ImportsPage } from '@/features/imports/imports-page';
import { RoadmapPage } from '@/features/roadmap/roadmap-page';
import { ReportsPage } from '@/features/reports/reports-page';
import { SettingsPage } from '@/pages/settings-page';
import { NotFoundPage } from '@/pages/not-found-page';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route
          path="profissionais"
          element={
            <RequireRole roles={['ADMIN', 'MANAGER']}>
              <ProfessionalsPage />
            </RequireRole>
          }
        />
        <Route path="profissionais/:id" element={<ProfessionalDetailPage />} />
        <Route path="fabricantes" element={<VendorsPage />} />
        <Route path="tecnologias" element={<TechnologiesPage />} />
        <Route path="certificacoes" element={<CertificationsPage />} />
        <Route path="tec-news" element={<NewsPage />} />
        <Route
          path="roadmap"
          element={
            <RequireRole roles={['ADMIN', 'MANAGER']}>
              <RoadmapPage />
            </RequireRole>
          }
        />
        <Route
          path="relatorios"
          element={
            <RequireRole roles={['ADMIN', 'MANAGER']}>
              <ReportsPage />
            </RequireRole>
          }
        />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route
          path="importar"
          element={
            <RequireRole roles={['ADMIN', 'MANAGER']}>
              <ImportsPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/index.html" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
