import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Save, Send } from 'lucide-react';
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
import { settingsService } from '@/services/settings.service';

const transportOptions = [
  { value: 'SMTP', label: 'SMTP' },
  { value: 'GRAPH', label: 'Microsoft Graph' },
];

export function EmailSettingsCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [smtpPassword, setSmtpPassword] = useState('');
  const [graphSecret, setGraphSecret] = useState('');
  const [form, setForm] = useState({
    enabled: false,
    transport: 'SMTP' as 'SMTP' | 'GRAPH',
    fromName: '',
    fromAddress: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    graphTenantId: '',
    graphClientId: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'email'],
    queryFn: () => settingsService.getEmail(),
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      enabled: data.enabled,
      transport: data.transport,
      fromName: data.fromName,
      fromAddress: data.fromAddress,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      smtpUser: data.smtpUser,
      graphTenantId: data.graphTenantId,
      graphClientId: data.graphClientId,
    });
  }, [data]);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['settings', 'email'] });

  const save = useMutation({
    mutationFn: () =>
      settingsService.updateEmail({
        ...form,
        ...(smtpPassword ? { smtpPassword } : {}),
        ...(graphSecret ? { graphClientSecret: graphSecret } : {}),
      }),
    onSuccess: () => {
      setSmtpPassword('');
      setGraphSecret('');
      invalidate();
      toast({ title: 'Configuração de e-mail salva', variant: 'success' });
    },
    onError: (error) =>
      toast({ title: 'Não foi possível salvar', description: extractApiError(error), variant: 'error' }),
  });

  const test = useMutation({
    mutationFn: () => settingsService.testEmail(),
    onSuccess: (result) =>
      toast({ title: 'Teste enviado', description: result.message, variant: 'success' }),
    onError: (error) =>
      toast({ title: 'Falha no envio', description: extractApiError(error), variant: 'error' }),
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              Envio de e-mail
            </CardTitle>
            <CardDescription>
              Transporte usado para enviar o Relatório Financeiro ao cliente.
            </CardDescription>
          </div>
          {data && (
            <Badge variant={data.configured ? 'success' : 'neutral'}>
              {data.configured ? 'Configurado' : 'Não configurado'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <LoadingState label="Carregando e-mail..." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                Habilitar o envio de e-mail
              </label>

              <div className="space-y-1.5">
                <Label htmlFor="e-transport">Transporte</Label>
                <Select
                  id="e-transport"
                  options={transportOptions}
                  value={form.transport}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, transport: e.target.value as 'SMTP' | 'GRAPH' }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-name">Nome do remetente</Label>
                <Input
                  id="e-name"
                  value={form.fromName}
                  onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="e-from">E-mail do remetente</Label>
                <Input
                  id="e-from"
                  value={form.fromAddress}
                  onChange={(e) => setForm((f) => ({ ...f, fromAddress: e.target.value }))}
                />
              </div>

              {form.transport === 'SMTP' ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="e-host">Servidor SMTP</Label>
                    <Input
                      id="e-host"
                      value={form.smtpHost}
                      onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="e-port">Porta</Label>
                    <Input
                      id="e-port"
                      type="number"
                      value={form.smtpPort}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, smtpPort: Number(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={form.smtpSecure}
                      onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked }))}
                    />
                    Conexão segura (TLS direto, ex.: 465)
                  </label>
                  <div className="space-y-1.5">
                    <Label htmlFor="e-user">Usuário</Label>
                    <Input
                      id="e-user"
                      value={form.smtpUser}
                      onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="e-pass">Senha</Label>
                    <Input
                      id="e-pass"
                      type="password"
                      autoComplete="off"
                      placeholder={data.smtpPasswordSet ? '•••••••• (manter)' : 'cole a senha'}
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="e-tenant">Tenant ID</Label>
                    <Input
                      id="e-tenant"
                      value={form.graphTenantId}
                      onChange={(e) => setForm((f) => ({ ...f, graphTenantId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="e-gcid">Client ID</Label>
                    <Input
                      id="e-gcid"
                      value={form.graphClientId}
                      onChange={(e) => setForm((f) => ({ ...f, graphClientId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="e-gsecret">Client Secret</Label>
                    <Input
                      id="e-gsecret"
                      type="password"
                      autoComplete="off"
                      placeholder={data.graphClientSecretSet ? '•••••••• (manter)' : 'cole o secret'}
                      value={graphSecret}
                      onChange={(e) => setGraphSecret(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => test.mutate()}
                disabled={test.isPending || save.isPending || !data.configured}
              >
                {test.isPending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                Enviar teste
              </Button>
              <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
