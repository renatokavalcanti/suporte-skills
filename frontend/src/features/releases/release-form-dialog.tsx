import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/toast';
import { releasesService } from '@/services/releases.service';
import { extractApiError } from '@/services/api';
import type { Release } from '@/types/entities';
import { releaseCategoryLabels, toDateInput, toOptions } from '@/utils/labels';

const itemSchema = z.object({
  category: z.string(),
  description: z.string().min(1, 'Descreva a mudança'),
});

const schema = z.object({
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Use o formato X.Y.Z (ex.: 1.2.3)'),
  title: z.string().min(1, 'Informe o título'),
  summary: z.string().optional(),
  releasedAt: z.string().min(1, 'Informe a data'),
  current: z.boolean().optional(),
  items: z.array(itemSchema).min(1, 'Inclua ao menos uma mudança'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  version: '',
  title: '',
  summary: '',
  releasedAt: '',
  current: false,
  items: [{ category: 'FEATURE', description: '' }],
};

export function ReleaseFormDialog({
  open,
  onClose,
  release,
}: {
  open: boolean;
  onClose: () => void;
  release?: Release | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(release);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (!open) return;
    if (release) {
      reset({
        version: release.version,
        title: release.title,
        summary: release.summary ?? '',
        releasedAt: toDateInput(release.releasedAt),
        current: release.current,
        items: release.items.length
          ? release.items.map((item) => ({
              category: item.category,
              description: item.description,
            }))
          : [{ category: 'FEATURE', description: '' }],
      });
    } else {
      reset(EMPTY);
    }
  }, [open, release, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        version: values.version.trim(),
        title: values.title.trim(),
        summary: values.summary?.trim() || null,
        releasedAt: values.releasedAt,
        current: values.current ?? false,
        items: values.items.map((item, index) => ({
          category: item.category,
          description: item.description.trim(),
          position: index,
        })),
      };
      return release
        ? releasesService.update(release.id, payload)
        : releasesService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['releases'] });
      toast({
        title: isEditing ? 'Release atualizada' : 'Release criada',
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
      title={isEditing ? 'Editar release' : 'Nova release'}
      description="Registre a versão e as mudanças correspondentes."
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
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rf-version">Versão *</Label>
            <Input id="rf-version" placeholder="1.2.3" {...register('version')} />
            {errors.version && (
              <p role="alert" className="text-xs text-red-600">
                {errors.version.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rf-date">Data *</Label>
            <Input id="rf-date" type="date" {...register('releasedAt')} />
            {errors.releasedAt && (
              <p role="alert" className="text-xs text-red-600">
                {errors.releasedAt.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-title">Título *</Label>
          <Input id="rf-title" {...register('title')} />
          {errors.title && (
            <p role="alert" className="text-xs text-red-600">
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-summary">Resumo</Label>
          <Textarea id="rf-summary" rows={2} {...register('summary')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-current">Situação</Label>
          <Select
            id="rf-current"
            options={[
              { value: 'false', label: 'Versão anterior' },
              { value: 'true', label: 'Versão atual' },
            ]}
            {...register('current', {
              setValueAs: (value) => value === 'true' || value === true,
            })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Mudanças *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ category: 'FEATURE', description: '' })}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <Select
                className="w-40 shrink-0"
                options={toOptions(releaseCategoryLabels)}
                {...register(`items.${index}.category` as const)}
              />
              <div className="flex-1">
                <Input
                  placeholder="Descreva a mudança"
                  {...register(`items.${index}.description` as const)}
                />
                {errors.items?.[index]?.description && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {errors.items[index]?.description?.message}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remover mudança"
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
          {errors.items?.root?.message && (
            <p role="alert" className="text-xs text-red-600">
              {errors.items.root.message}
            </p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
