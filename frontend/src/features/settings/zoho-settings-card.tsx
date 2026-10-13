import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlugZap, RefreshCw, Save, Unplug, Cable } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { LoadingState } from '@/components/feedback';
import { useToast } from '@/components/toast';
import { extractApiError } from '@/services/api';
import { zohoSettingsService } from '@/services/zoho-settings.service';
import type { ZohoDataCenter, ZohoSyncFrequency } from '@/types/reports';

const dcOptions = [
  { value: 'com', label: 'com — Global (desk.zoho.com)' },
  { value: 'eu', label: 'eu — Europa (desk.zoho.eu)' },
  { value: 'in', label: 'in — Índia (desk.zoho.in)' },
  { value: 'au', label: 'au — Austrália (desk.zoho.com.au)' },
  { value: 'cn', label: 'cn — China (desk.zoho.com.cn)' },
  { value: 'jp', label: 'jp — Japão (desk.zoho.jp)' },
];

const clientSourceOptions = [
  { value: 'ACCOUNT', label: 'Account (padrão)' },
  { value: 'CONTACT', label: 'Contact' },
];

const frequencyOptions = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'HOURLY', label: 'A cada 1 hora' },
  { value: 'SIX_HOURS', label: 'A cada 6 horas' },
  { value: 'DAILY', label: 'Diária' },
];

export function ZohoSettingsCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [form, setForm] = useState({
    dataCenter: 'com' as ZohoDataCenter,
    clientId: '',
    orgId: '',
    technologyField: '',
    clientSource: 'ACCOUNT' as 'ACCOUNT' | 'CONTACT',
    syncFrequency: 'MANUAL' as ZohoSyncFrequency,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'zoho'],
    queryFn: () => zohoSettingsService.get(),
  });

  const { data: syncLog } = useQuery({
    queryKey: ['settings', 'zoho', 'sync-log'],
    queryFn: () => zohoSettingsService.syncLog(),
    enabled: Boolean(data?.configured),
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      dataCenter: data.dataCenter,
      clientId: data.clientId,
      orgId: data.orgId,
      technologyField: data.technologyField ?? '',
      clientSource: data.clientSource,
      syncFrequency: data.syncFrequency,
    });
  }, [data]);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['settings', 'zoho'] });

  const save = useMutation({
    mutationFn: () =>
      zohoSettingsService.update({
        ...form,
        ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
        ...(refreshToken.trim() ? { refreshToken: refreshToken.trim() } : {}),
      }),
    onSuccess: () => {
      setClientSecret('');
      setRefreshToken('');
      invalidate();
      toast({ title: 'Integração salva', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível salvar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const test = useMutation({
    mutationFn: () => zohoSettingsService.test({}),
    onSuccess: (result) =>
      toast({ title: 'Conexão OK', description: result.message, variant: 'success' }),
    onError: (error) =>
      toast({
        title: 'Falha na conexão',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const connect = useMutation({
    mutationFn: () => zohoSettingsService.authUrl(),
    onSuccess: ({ url }) => {
      window.open(url, '_blank', 'noopener');
      toast({
        title: 'Autorize no Zoho',
        description: 'Conclua a autorização na aba aberta. Ao voltar, a conta estará conectada.',
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível iniciar a conexão',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const sync = useMutation({
    mutationFn: () => zohoSettingsService.sync(),
    onSuccess: (summary) => {
      invalidate();
      toast({
        title: 'Sincronização concluída',
        description: `${summary.created} criado(s), ${summary.updated} atualizado(s), ${summary.unmapped} não mapeado(s).`,
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Falha na sincronização',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const disconnect = useMutation({
    mutationFn: () => zohoSettingsService.disconnect(),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Desconectado', variant: 'success' });
    },
    onError: (error) =>
      toast({ title: 'Não foi possível desconectar', description: extractApiError(error), variant: 'error' }),
  });

  const busy =
    save.isPending || test.isPending || connect.isPending || sync.isPending || disconnect.isPending;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cable className="h-4 w-4 text-blue-600" />
              Integração Zoho Desk
            </CardTitle>
            <CardDescription>
              Configuração do espelhamento (somente leitura) dos chamados. As
              credenciais são cifradas e nunca são exibidas.
            </CardDescription>
          </div>
          {data && (
            <Badge variant={data.configured ? 'success' : 'neutral'}>
              {data.configured ? 'Configurada' : 'Não configurada'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <LoadingState label="Carregando integração..." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="z-dc">Data center</Label>
                <Select
                  id="z-dc"
                  options={dcOptions}
                  value={form.dataCenter}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dataCenter: e.target.value as ZohoDataCenter }))
                  }
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  API: {data.apiBaseUrl} · OAuth: {data.accountsBaseUrl}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="z-cid">Client ID</Label>
                <Input
                  id="z-cid"
                  value={form.clientId}
                  onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="z-secret">Client Secret</Label>
                <Input
                  id="z-secret"
                  type="password"
                  autoComplete="off"
                  placeholder={data.clientSecretSet ? '•••••••• (manter)' : 'cole o secret'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="z-org">orgId</Label>
                <Input
                  id="z-org"
                  value={form.orgId}
                  onChange={(e) => setForm((f) => ({ ...f, orgId: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="z-refresh">Refresh Token</Label>
                <Input
                  id="z-refresh"
                  type="password"
                  autoComplete="off"
                  placeholder={data.refreshTokenSet ? '•••••••• (manter)' : 'via Conectar com Zoho'}
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="z-tech">Campo de tecnologia (API do Zoho)</Label>
                <Input
                  id="z-tech"
                  placeholder="ex.: Tecnologia"
                  value={form.technologyField}
                  onChange={(e) => setForm((f) => ({ ...f, technologyField: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="z-source">Origem do cliente</Label>
                <Select
                  id="z-source"
                  options={clientSourceOptions}
                  value={form.clientSource}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, clientSource: e.target.value as 'ACCOUNT' | 'CONTACT' }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="z-freq">Frequência de sincronização</Label>
                <Select
                  id="z-freq"
                  options={frequencyOptions}
                  value={form.syncFrequency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, syncFrequency: e.target.value as ZohoSyncFrequency }))
                  }
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Redirect URI (configurar no Zoho API Console)</Label>
                <Input readOnly value={data.redirectUri} className="font-mono text-xs" />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Escopos</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {data.scopes.join(', ')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => test.mutate()}
                disabled={busy}
              >
                {test.isPending ? <Spinner className="h-4 w-4" /> : <PlugZap className="h-4 w-4" />}
                Testar conexão
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => connect.mutate()}
                disabled={busy}
              >
                {connect.isPending ? <Spinner className="h-4 w-4" /> : <Cable className="h-4 w-4" />}
                Conectar com Zoho
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => sync.mutate()}
                disabled={busy || !data.configured}
              >
                {sync.isPending ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                Sincronizar agora
              </Button>
              {data.configured && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => disconnect.mutate()}
                  disabled={busy}
                >
                  <Unplug className="h-4 w-4 text-red-500" />
                  Desconectar
                </Button>
              )}
              <Button type="button" onClick={() => save.mutate()} disabled={busy}>
                {save.isPending ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>

            {syncLog && syncLog.length > 0 && (
              <div className="rounded-md border border-slate-200 p-3 text-xs dark:border-slate-800">
                <p className="mb-1 font-medium text-slate-700 dark:text-slate-300">
                  Últimas sincronizações
                </p>
                <ul className="space-y-0.5 text-slate-500 dark:text-slate-400">
                  {syncLog.slice(0, 5).map((entry) => (
                    <li key={entry.at}>
                      {new Date(entry.at).toLocaleString('pt-BR')} — {entry.status} ·{' '}
                      {entry.created} criado(s), {entry.updated} atualizado(s),{' '}
                      {entry.unmapped} não mapeado(s), {entry.errors} erro(s)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.secretSource === 'env' && (
              <p className="text-xs text-amber-600">
                Credenciais atualmente vindas do ambiente (ZOHO_*). Salvar aqui sobrepõe o ambiente.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
