import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/toast';
import { newsService } from '@/services/news.service';
import { vendorsService } from '@/services/vendors.service';
import { technologiesService } from '@/services/technologies.service';
import { extractApiError } from '@/services/api';
import type { NewsItem } from '@/types/entities';
import { newsKindLabels, toDateInput, toOptions } from '@/utils/labels';

const schema = z.object({
  title: z.string().min(1, 'Informe o título'),
  url: z.string().url('Informe um link válido (https://...)'),
  vendorId: z.string().optional(),
  technologyId: z.string().optional(),
  kind: z.string().optional(),
  summary: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.string().optional(),
  pinned: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewsFormDialog({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item?: NewsItem | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(item);

  const { data: vendors } = useQuery({
    queryKey: ['vendors', 'options'],
    queryFn: () => vendorsService.list({ pageSize: 200, sort: 'name' }),
    enabled: open,
  });

  const { data: technologies } = useQuery({
    queryKey: ['technologies', 'options'],
    queryFn: () => technologiesService.list({ pageSize: 200, sort: 'name' }),
    enabled: open,
  });

  const vendorOptions = useMemo(
    () => (vendors?.data ?? []).map((v) => ({ value: v.id, label: v.name })),
    [vendors],
  );
  const technologyOptions = useMemo(
    () =>
      (technologies?.data ?? []).map((t) => ({
        value: t.id,
        label: `${t.name} — ${t.vendor.name}`,
      })),
    [technologies],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      url: '',
      vendorId: '',
      technologyId: '',
      kind: '',
      summary: '',
      author: '',
      publishedAt: '',
      pinned: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (item) {
      reset({
        title: item.title,
        url: item.url,
        vendorId: item.vendorId ?? '',
        technologyId: item.technologyId ?? '',
        kind: item.kind,
        summary: item.summary ?? '',
        author: item.author ?? '',
        publishedAt: toDateInput(item.publishedAt),
        pinned: item.pinned,
      });
    } else {
      reset({
        title: '',
        url: '',
        vendorId: '',
        technologyId: '',
        kind: '',
        summary: '',
        author: '',
        publishedAt: '',
        pinned: false,
      });
    }
  }, [open, item, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title.trim(),
        url: values.url.trim(),
        vendorId: values.vendorId || null,
        technologyId: values.technologyId || null,
        kind: values.kind || undefined,
        summary: values.summary?.trim() || null,
        author: values.author?.trim() || null,
        publishedAt: values.publishedAt || null,
        pinned: values.pinned ?? false,
      };
      return item
        ? newsService.update(item.id, payload)
        : newsService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['news'] });
      toast({
        title: isEditing ? 'Novidade atualizada' : 'Novidade cadastrada',
        variant: 'success',
      });
      onClose();
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível salvar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableClose={mutation.isPending}
      size="lg"
      title={isEditing ? 'Editar novidade' : 'Nova novidade'}
      description="Cadastro manual para canais sem feed ou para destacar algo relevante."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit((values) => mutation.mutate(values))}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Spinner className="h-4 w-4 text-white" />}
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="nf-title">Título *</Label>
          <Input id="nf-title" {...register('title')} />
          {errors.title && (
            <p role="alert" className="text-xs text-red-600">
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="nf-url">Link oficial *</Label>
          <Input id="nf-url" placeholder="https://..." {...register('url')} />
          {errors.url && (
            <p role="alert" className="text-xs text-red-600">
              {errors.url.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nf-vendor">Fabricante</Label>
          <Select
            id="nf-vendor"
            placeholder="Não informado"
            options={vendorOptions}
            {...register('vendorId')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nf-technology">Tecnologia</Label>
          <Select
            id="nf-technology"
            placeholder="Não informada"
            options={technologyOptions}
            {...register('technologyId')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nf-kind">Tipo</Label>
          <Select
            id="nf-kind"
            placeholder="Geral"
            options={toOptions(newsKindLabels)}
            {...register('kind')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nf-published">Publicado em</Label>
          <Input id="nf-published" type="date" {...register('publishedAt')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nf-author">Autor</Label>
          <Input id="nf-author" {...register('author')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nf-pinned">Destaque</Label>
          <Select
            id="nf-pinned"
            options={[
              { value: 'false', label: 'Normal' },
              { value: 'true', label: 'Fixar no topo' },
            ]}
            {...register('pinned', {
              setValueAs: (value) => value === 'true' || value === true,
            })}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="nf-summary">Resumo</Label>
          <Textarea id="nf-summary" rows={3} {...register('summary')} />
        </div>
      </form>
    </Dialog>
  );
}
