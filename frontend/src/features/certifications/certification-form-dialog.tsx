import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { certificationsService } from '@/services/certifications.service';
import { technologiesService } from '@/services/technologies.service';
import { vendorsService } from '@/services/vendors.service';
import { extractApiError } from '@/services/api';
import type { Certification } from '@/types/entities';
import {
  catalogStatusLabels,
  certificationLevelLabels,
  toOptions,
} from '@/utils/labels';

const schema = z.object({
  vendorId: z.string().min(1, 'Selecione o fabricante'),
  technologyId: z.string().optional(),
  name: z.string().min(1, 'Informe o nome da certificação'),
  code: z.string().optional(),
  level: z.string().optional(),
  officialUrl: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^https?:\/\/.+/.test(value),
      'Informe uma URL válida',
    ),
  validityMonths: z
    .string()
    .optional()
    .refine(
      (value) => !value || (Number(value) > 0 && Number(value) <= 600),
      'Validade deve ser entre 1 e 600 meses',
    ),
  catalogStatus: z.string().min(1),
  description: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  vendorId: '',
  technologyId: '',
  name: '',
  code: '',
  level: '',
  officialUrl: '',
  validityMonths: '',
  catalogStatus: 'ACTIVE',
  description: '',
  notes: '',
  active: true,
};

export function CertificationFormDialog({
  open,
  onClose,
  certification,
}: {
  open: boolean;
  onClose: () => void;
  certification?: Certification | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(certification);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  const vendorId = useWatch({ control, name: 'vendorId' });

  const {
    data: vendors,
    isLoading: vendorsLoading,
    isError: vendorsError,
  } = useQuery({
    queryKey: ['vendors', 'options'],
    queryFn: () => vendorsService.list({ pageSize: 200, sort: 'name' }),
    enabled: open,
  });

  const { data: technologies } = useQuery({
    queryKey: ['technologies', 'options', vendorId],
    queryFn: () => technologiesService.list({ vendorId, pageSize: 200, sort: 'name' }),
    enabled: open && Boolean(vendorId),
  });

  const vendorOptions = useMemo(
    () => (vendors?.data ?? []).map((v) => ({ value: v.id, label: v.name })),
    [vendors],
  );
  const technologyOptions = useMemo(
    () => (technologies?.data ?? []).map((t) => ({ value: t.id, label: t.name })),
    [technologies],
  );

  useEffect(() => {
    if (!open) return;
    if (certification) {
      reset({
        vendorId: certification.vendorId,
        technologyId: certification.technologyId ?? '',
        name: certification.name,
        code: certification.code ?? '',
        level: certification.level ?? '',
        officialUrl: certification.officialUrl ?? '',
        validityMonths: certification.validityMonths
          ? String(certification.validityMonths)
          : '',
        catalogStatus: certification.catalogStatus,
        description: certification.description ?? '',
        notes: certification.notes ?? '',
        active: certification.active,
      });
    } else {
      reset(emptyValues);
    }
  }, [open, certification, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        vendorId: values.vendorId,
        technologyId: values.technologyId || null,
        name: values.name.trim(),
        code: values.code?.trim() || null,
        level: (values.level || null) as never,
        officialUrl: values.officialUrl?.trim() || null,
        validityMonths: values.validityMonths ? Number(values.validityMonths) : null,
        catalogStatus: values.catalogStatus,
        description: values.description?.trim() || null,
        notes: values.notes?.trim() || null,
        active: values.active ?? true,
      };
      return certification
        ? certificationsService.update(certification.id, payload)
        : certificationsService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['certifications'] });
      toast({
        title: isEditing ? 'Certificação atualizada' : 'Certificação criada',
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
      title={isEditing ? 'Editar certificação' : 'Nova certificação'}
      description="Certificação do catálogo, vinculada a fabricante e tecnologia."
      size="lg"
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
          <Label htmlFor="cf-vendor">Fabricante *</Label>
          <Select
            id="cf-vendor"
            placeholder="Selecione"
            disabled={vendorsLoading || vendorsError}
            options={vendorOptions}
            {...register('vendorId', {
              onChange: () => setValue('technologyId', ''),
            })}
          />
          {errors.vendorId && (
            <p role="alert" className="text-xs text-red-600">{errors.vendorId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-tech">Tecnologia</Label>
          <Select
            id="cf-tech"
            placeholder={vendorId ? 'Não vinculada' : 'Escolha o fabricante antes'}
            options={technologyOptions}
            disabled={!vendorId}
            {...register('technologyId')}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cf-name">Nome *</Label>
          <Input id="cf-name" {...register('name')} />
          {errors.name && (
            <p role="alert" className="text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-code">Código</Label>
          <Input id="cf-code" placeholder="Ex.: EX200" {...register('code')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-level">Nível</Label>
          <Select
            id="cf-level"
            placeholder="Não informado"
            options={toOptions(certificationLevelLabels)}
            {...register('level')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-validity">Validade (meses)</Label>
          <Input
            id="cf-validity"
            type="number"
            min={1}
            max={600}
            placeholder="Deixe vazio se não expira"
            {...register('validityMonths')}
          />
          {errors.validityMonths && (
            <p role="alert" className="text-xs text-red-600">{errors.validityMonths.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-catalog">Status do catálogo</Label>
          <Select
            id="cf-catalog"
            options={toOptions(catalogStatusLabels)}
            {...register('catalogStatus')}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cf-url">URL oficial</Label>
          <Input id="cf-url" placeholder="https://" {...register('officialUrl')} />
          {errors.officialUrl && (
            <p role="alert" className="text-xs text-red-600">{errors.officialUrl.message}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cf-description">Descrição</Label>
          <Textarea id="cf-description" rows={2} {...register('description')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-active">Situação</Label>
          <Select
            id="cf-active"
            options={[
              { value: 'true', label: 'Ativa' },
              { value: 'false', label: 'Inativa' },
            ]}
            {...register('active', {
              setValueAs: (value) => value === 'true' || value === true,
            })}
          />
        </div>
      </form>
    </Dialog>
  );
}
