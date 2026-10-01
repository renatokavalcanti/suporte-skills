import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlugZap, Save, Sparkles, Trash2 } from 'lucide-react';
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
import { Spinner } from '@/components/ui/spinner';
import { LoadingState } from '@/components/feedback';
import { useToast } from '@/components/toast';
import { settingsService } from '@/services/settings.service';
import { extractApiError } from '@/services/api';

const schema = z.object({
  enabled: z.boolean(),
  baseUrl: z
    .string()
    .min(1, 'Informe a URL do provedor')
    .url('URL inválida (use http(s)://)'),
  model: z.string().min(1, 'Informe o modelo'),
  timeoutMs: z
    .number({ error: 'Informe um número' })
    .int('Número inteiro')
    .min(1000, 'Mínimo 1000 ms')
    .max(120000, 'Máximo 120000 ms'),
  digestEnabled: z.boolean(),
  digestWindowDays: z
    .number({ error: 'Informe um número' })
    .int('Número inteiro')
    .min(1, 'Mínimo 1 dia')
    .max(90, 'Máximo 90 dias'),
  digestMaxItems: z
    .number({ error: 'Informe um número' })
    .int('Número inteiro')
    .min(1, 'Mínimo 1')
    .max(100, 'Máximo 100'),
});

type FormValues = z.infer<typeof schema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  );
}

export function AiSettingsCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'ai'],
    queryFn: () => settingsService.getAi(),
  });

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      enabled: false,
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      timeoutMs: 20000,
      digestEnabled: false,
      digestWindowDays: 7,
      digestMaxItems: 20,
    },
  });

  useEffect(() => {
    if (!data) return;
    reset({
      enabled: data.enabled,
      baseUrl: data.baseUrl,
      model: data.model,
      timeoutMs: data.timeoutMs,
      digestEnabled: data.digestEnabled,
      digestWindowDays: data.digestWindowDays,
      digestMaxItems: data.digestMaxItems,
    });
  }, [data, reset]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['settings', 'ai'] });
    void queryClient.invalidateQueries({ queryKey: ['news'] });
  };

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      settingsService.updateAi({
        ...values,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      }),
    onSuccess: () => {
      setApiKey('');
      invalidate();
      toast({ title: 'Configurações de IA salvas', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível salvar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const test = useMutation({
    mutationFn: () => {
      const values = getValues();
      return settingsService.testAi({
        baseUrl: values.baseUrl,
        model: values.model,
        timeoutMs: values.timeoutMs,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
    },
    onSuccess: (result) =>
      toast({
        title: 'Conexão bem-sucedida',
        description: `${result.message} (modelo ${result.model}).`,
        variant: 'success',
      }),
    onError: (error) =>
      toast({
        title: 'Falha na conexão',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const clearKey = useMutation({
    mutationFn: () => settingsService.updateAi({ clearApiKey: true }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Chave removida', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível remover a chave',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const apiKeyHint =
    data?.apiKeySource === 'settings'
      ? 'Chave salva aqui nas configurações.'
      : data?.apiKeySource === 'env'
        ? 'Chave definida pela variável de ambiente AI_API_KEY.'
        : 'Nenhuma chave definida.';

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Inteligência Artificial (Tec News)
            </CardTitle>
            <CardDescription>
              Ativa o resumo dos destaques do Tec News. Aceita qualquer provedor
              compatível com OpenAI (OpenAI, DeepSeek, Groq, OpenRouter, Ollama...).
            </CardDescription>
          </div>
          {data && (
            <Badge variant={data.enabled ? 'success' : 'neutral'}>
              {data.enabled ? 'Ativa' : 'Desativada'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState label="Carregando configurações..." />
        ) : (
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={handleSubmit((values) => save.mutate(values))}
            noValidate
          >
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                {...register('enabled')}
              />
              Ativar o resumo inteligente
            </label>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ai-base-url">URL do provedor</Label>
              <Input
                id="ai-base-url"
                placeholder="https://api.openai.com/v1"
                {...register('baseUrl')}
              />
              <FieldError message={errors.baseUrl?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-model">Modelo</Label>
              <Input
                id="ai-model"
                placeholder="gpt-4o-mini"
                {...register('model')}
              />
              <FieldError message={errors.model?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-timeout">Timeout (ms)</Label>
              <Input
                id="ai-timeout"
                type="number"
                min={1000}
                max={120000}
                {...register('timeoutMs', { valueAsNumber: true })}
              />
              <FieldError message={errors.timeoutMs?.message} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ai-key">Chave da API</Label>
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                placeholder={
                  data?.apiKeySet
                    ? '•••••••• (deixe em branco para manter)'
                    : 'cole a chave do provedor'
                }
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {apiKeyHint}
                </p>
                {data?.apiKeySource === 'settings' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => clearKey.mutate()}
                    disabled={clearKey.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                    Remover chave
                  </Button>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                {...register('digestEnabled')}
              />
              Gerar o resumo automaticamente ao fim de cada sincronização
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="ai-window">Janela do resumo (dias)</Label>
              <Input
                id="ai-window"
                type="number"
                min={1}
                max={90}
                {...register('digestWindowDays', { valueAsNumber: true })}
              />
              <FieldError message={errors.digestWindowDays?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-max-items">Máx. de novidades por resumo</Label>
              <Input
                id="ai-max-items"
                type="number"
                min={1}
                max={100}
                {...register('digestMaxItems', { valueAsNumber: true })}
              />
              <FieldError message={errors.digestMaxItems?.message} />
            </div>

            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => test.mutate()}
                disabled={test.isPending || save.isPending}
              >
                {test.isPending ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <PlugZap className="h-4 w-4" />
                )}
                Testar conexão
              </Button>
              <Button
                type="submit"
                disabled={save.isPending || (!isDirty && apiKey.trim() === '')}
              >
                {save.isPending ? (
                  <Spinner className="h-4 w-4 text-white" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
