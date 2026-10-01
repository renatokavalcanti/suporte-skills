import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/feedback';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import { roleLabels } from '@/utils/labels';
import { AiSettingsCard } from '@/features/settings/ai-settings-card';
import type { HealthResponse } from '@/types/api';

function HealthCard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: async () =>
      (await api.get<HealthResponse>('/health')).data,
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <LoadingState label="Consultando a API..." />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        message="Não foi possível consultar a API."
        onRetry={() => void refetch()}
      />
    );
  }

  const ok = data.status === 'ok';
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          API /v1/health
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Banco de dados: {data.database} · {new Date(data.timestamp).toLocaleString('pt-BR')}
        </p>
      </div>
      <Badge variant={ok ? 'success' : 'danger'}>
        {ok ? 'Operacional' : 'Degradado'}
      </Badge>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { canWrite, isAdmin } = usePermissions();

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Sessão, aparência e parâmetros do sistema."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {isAdmin && <AiSettingsCard />}

        <Card>
          <CardHeader>
            <CardTitle>Sessão</CardTitle>
            <CardDescription>Usuário autenticado neste dispositivo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-slate-800 dark:text-slate-200">{user?.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user?.email}
            </p>
            <div className="pt-2">
              <Badge variant="info">
                {user?.role ? roleLabels[user.role] : '—'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saúde do sistema</CardTitle>
            <CardDescription>Verificação em tempo real do backend.</CardDescription>
          </CardHeader>
          <CardContent>
            <HealthCard />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
            <CardDescription>
              Tema atual: {theme === 'dark' ? 'escuro' : 'claro'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              O tema pode ser alternado pelo botão na barra superior. O modo claro
              é o padrão.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parâmetros</CardTitle>
            <CardDescription>
              Regras de negócio configuráveis (Fase 1).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Limiar de vencimento: configurado no backend por{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
                CERT_EXPIRING_DAYS
              </code>{' '}
              (padrão 90 dias). O gerenciamento pela interface chega em fase
              futura.
            </p>
          </CardContent>
        </Card>

        {canWrite && (
          <Card>
            <CardHeader>
              <CardTitle>Importação de dados</CardTitle>
              <CardDescription>
                Carregue profissionais ou certificações via CSV.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/importar"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <Upload className="h-4 w-4" />
                Ir para importação
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
