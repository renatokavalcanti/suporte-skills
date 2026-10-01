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
import { professionalsService } from '@/services/professionals.service';
import { certificationsService } from '@/services/certifications.service';
import { vendorsService } from '@/services/vendors.service';
import { extractApiError } from '@/services/api';
import type { ProfessionalCertification } from '@/types/entities';
import { toDateInput } from '@/utils/labels';

const schema = z.object({
  vendorId: z.string().min(1, 'Selecione o fabricante'),
  certificationId: z.string().min(1, 'Selecione a certificação'),
  obtainedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  certificateNumber: z.string().optional(),
  proofUrl: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^https?:\/\/.+/.test(value),
      'Informe uma URL válida',
    ),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  vendorId: '',
  certificationId: '',
  obtainedAt: '',
  expiresAt: '',
  certificateNumber: '',
  proofUrl: '',
  notes: '',
};

function addMonths(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function ProfessionalCertificationFormDialog({
  open,
  onClose,
  professionalId,
  record,
}: {
  open: boolean;
  onClose: () => void;
  professionalId: string;
  record?: ProfessionalCertification | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(record);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  const vendorId = useWatch({ control, name: 'vendorId' });
  const certificationId = useWatch({ control, name: 'certificationId' });
  const obtainedAt = useWatch({ control, name: 'obtainedAt' });

  const {
    data: vendors,
    isLoading: vendorsLoading,
    isError: vendorsError,
  } = useQuery({
    queryKey: ['vendors', 'options'],
    queryFn: () => vendorsService.list({ pageSize: 200, sort: 'name' }),
    enabled: open,
  });

  const { data: certifications } = useQuery({
    queryKey: ['certifications', 'options', vendorId],
    queryFn: () => certificationsService.list({ vendorId, pageSize: 200, sort: 'name' }),
    enabled: open && Boolean(vendorId),
  });

  const vendorOptions = useMemo(
    () => (vendors?.data ?? []).map((v) => ({ value: v.id, label: v.name })),
    [vendors],
  );
  const certificationOptions = useMemo(
    () =>
      (certifications?.data ?? []).map((c) => ({
        value: c.id,
        label: c.code ? `${c.name} (${c.code})` : c.name,
      })),
    [certifications],
  );

  useEffect(() => {
    if (!open) return;
    if (record) {
      reset({
        vendorId: record.certification.vendor.id,
        certificationId: record.certificationId,
        obtainedAt: toDateInput(record.obtainedAt),
        expiresAt: toDateInput(record.expiresAt),
        certificateNumber: record.certificateNumber ?? '',
        proofUrl: record.proofUrl ?? '',
        notes: record.notes ?? '',
      });
    } else {
      reset(emptyValues);
    }
  }, [open, record, reset]);

  // Sugere a expiração a partir da validade da certificação.
  useEffect(() => {
    if (!open || !obtainedAt || !certificationId) return;
    if (getValues('expiresAt')) return;
    const selected = (certifications?.data ?? []).find((c) => c.id === certificationId);
    if (selected?.validityMonths) {
      setValue('expiresAt', addMonths(obtainedAt, selected.validityMonths));
    }
  }, [open, obtainedAt, certificationId, certifications, getValues, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        certificationId: values.certificationId,
        obtainedAt: values.obtainedAt || null,
        expiresAt: values.expiresAt || null,
        certificateNumber: values.certificateNumber?.trim() || null,
        proofUrl: values.proofUrl?.trim() || null,
        notes: values.notes?.trim() || null,
      };
      return record
        ? professionalsService.updateCertification(professionalId, record.id, payload)
        : professionalsService.addCertification(professionalId, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['professional', professionalId],
      });
      toast({
        title: isEditing ? 'Vinculação atualizada' : 'Certificação vinculada',
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
      title={isEditing ? 'Editar certificação do profissional' : 'Vincular certificação'}
      description="Histórico é preservado: renovar cria um novo registro."
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
            {isEditing ? 'Salvar' : 'Vincular'}
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
          <Label htmlFor="pcf-vendor">Fabricante *</Label>
          <Select
            id="pcf-vendor"
            placeholder="Selecione"
            options={vendorOptions}
            disabled={isEditing || vendorsLoading || vendorsError}
            {...register('vendorId', { onChange: () => setValue('certificationId', '') })}
          />
          {errors.vendorId && (
            <p role="alert" className="text-xs text-red-600">{errors.vendorId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pcf-cert">Certificação *</Label>
          <Select
            id="pcf-cert"
            placeholder={vendorId ? 'Selecione' : 'Escolha o fabricante antes'}
            options={certificationOptions}
            disabled={!vendorId || isEditing}
            {...register('certificationId')}
          />
          {errors.certificationId && (
            <p role="alert" className="text-xs text-red-600">{errors.certificationId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pcf-obtained">Data de obtenção</Label>
          <Input id="pcf-obtained" type="date" {...register('obtainedAt')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pcf-expires">Data de expiração</Label>
          <Input id="pcf-expires" type="date" {...register('expiresAt')} />
          <p className="text-[11px] text-slate-400">
            Deixe vazio se a certificação não expira.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pcf-number">Número do certificado</Label>
          <Input id="pcf-number" {...register('certificateNumber')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pcf-proof">URL da comprovação</Label>
          <Input id="pcf-proof" placeholder="https://" {...register('proofUrl')} />
          {errors.proofUrl && (
            <p role="alert" className="text-xs text-red-600">{errors.proofUrl.message}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pcf-notes">Observações</Label>
          <Textarea id="pcf-notes" rows={2} {...register('notes')} />
        </div>
      </form>
    </Dialog>
  );
}
