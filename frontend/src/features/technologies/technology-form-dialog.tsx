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
import { technologiesService } from '@/services/technologies.service';
import { vendorsService } from '@/services/vendors.service';
import { extractApiError } from '@/services/api';
import type { Technology } from '@/types/entities';
import { technologyCategoryLabels, toOptions } from '@/utils/labels';

const schema = z.object({
  vendorId: z.string().min(1, 'Selecione o fabricante'),
  name: z.string().min(1, 'Informe o nome da tecnologia'),
  category: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export function TechnologyFormDialog({
  open,
  onClose,
  technology,
}: {
  open: boolean;
  onClose: () => void;
  technology?: Technology | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(technology);

  const {
    data: vendors,
    isLoading: vendorsLoading,
    isError: vendorsError,
  } = useQuery({
    queryKey: ['vendors', 'options'],
    queryFn: () => vendorsService.list({ pageSize: 200, sort: 'name' }),
    enabled: open,
  });

  const vendorOptions = useMemo(
    () => (vendors?.data ?? []).map((vendor) => ({ value: vendor.id, label: vendor.name })),
    [vendors],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { vendorId: '', name: '', category: '', description: '', active: true },
  });

  useEffect(() => {
    if (!open) return;
    if (technology) {
      reset({
        vendorId: technology.vendorId,
        name: technology.name,
        category: technology.category ?? '',
        description: technology.description ?? '',
        active: technology.active,
      });
    } else {
      reset({ vendorId: '', name: '', category: '', description: '', active: true });
    }
  }, [open, technology, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        vendorId: values.vendorId,
        name: values.name.trim(),
        category: (values.category || null) as never,
        description: values.description?.trim() || null,
        active: values.active ?? true,
      };
      return technology
        ? technologiesService.update(technology.id, payload)
        : technologiesService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['technologies'] });
      toast({
        title: isEditing ? 'Tecnologia atualizada' : 'Tecnologia criada',
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
      title={isEditing ? 'Editar tecnologia' : 'Nova tecnologia'}
      description="Produto ou plataforma vinculada a um fabricante."
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
        <div className="space-y-1.5">
          <Label htmlFor="tf-vendor">Fabricante *</Label>
          <Select
            id="tf-vendor"
            placeholder="Selecione"
            disabled={vendorsLoading || vendorsError}
            options={vendorOptions}
            {...register('vendorId')}
          />
          {errors.vendorId && (
            <p role="alert" className="text-xs text-red-600">{errors.vendorId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tf-name">Nome *</Label>
          <Input id="tf-name" {...register('name')} />
          {errors.name && (
            <p role="alert" className="text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tf-category">Categoria</Label>
          <Select
            id="tf-category"
            placeholder="Não informada"
            options={toOptions(technologyCategoryLabels)}
            {...register('category')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tf-active">Situação</Label>
          <Select
            id="tf-active"
            options={[
              { value: 'true', label: 'Ativa' },
              { value: 'false', label: 'Inativa' },
            ]}
            {...register('active', {
              setValueAs: (value) => value === 'true' || value === true,
            })}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="tf-description">Descrição</Label>
          <Textarea id="tf-description" rows={3} {...register('description')} />
        </div>
      </form>
    </Dialog>
  );
}
