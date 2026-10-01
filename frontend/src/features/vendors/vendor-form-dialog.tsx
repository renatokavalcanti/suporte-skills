import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/toast';
import { vendorsService } from '@/services/vendors.service';
import { extractApiError } from '@/services/api';
import type { Vendor } from '@/types/entities';
import {
  partnershipStatusLabels,
  toDateInput,
  toOptions,
} from '@/utils/labels';

const schema = z.object({
  name: z.string().min(1, 'Informe o nome do fabricante'),
  website: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^https?:\/\/.+/.test(value),
      'Informe uma URL válida (http:// ou https://)',
    ),
  logoUrl: z.string().optional(),
  partnershipStatus: z.string().min(1),
  partnershipLevel: z.string().optional(),
  partnershipStartDate: z.string().optional(),
  partnershipRenewalDate: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  name: '',
  website: '',
  logoUrl: '',
  partnershipStatus: 'NONE',
  partnershipLevel: '',
  partnershipStartDate: '',
  partnershipRenewalDate: '',
  notes: '',
  active: true,
};

export function VendorFormDialog({
  open,
  onClose,
  vendor,
}: {
  open: boolean;
  onClose: () => void;
  vendor?: Vendor | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(vendor);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  useEffect(() => {
    if (!open) return;
    if (vendor) {
      reset({
        name: vendor.name,
        website: vendor.website ?? '',
        logoUrl: vendor.logoUrl ?? '',
        partnershipStatus: vendor.partnershipStatus,
        partnershipLevel: vendor.partnershipLevel ?? '',
        partnershipStartDate: toDateInput(vendor.partnershipStartDate),
        partnershipRenewalDate: toDateInput(vendor.partnershipRenewalDate),
        notes: vendor.notes ?? '',
        active: vendor.active,
      });
    } else {
      reset(emptyValues);
    }
  }, [open, vendor, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name.trim(),
        website: values.website?.trim() || null,
        logoUrl: values.logoUrl?.trim() || null,
        partnershipStatus: values.partnershipStatus,
        partnershipLevel: values.partnershipLevel?.trim() || null,
        partnershipStartDate: values.partnershipStartDate || null,
        partnershipRenewalDate: values.partnershipRenewalDate || null,
        notes: values.notes?.trim() || null,
        active: values.active ?? true,
      };
      return vendor
        ? vendorsService.update(vendor.id, payload)
        : vendorsService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({
        title: isEditing ? 'Fabricante atualizado' : 'Fabricante criado',
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
      title={isEditing ? 'Editar fabricante' : 'Novo fabricante'}
      description="Parceiro tecnológico, nível e datas de parceria."
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
          <Label htmlFor="vf-name">Nome *</Label>
          <Input id="vf-name" {...register('name')} />
          {errors.name && (
            <p role="alert" className="text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="vf-website">Website</Label>
          <Input id="vf-website" placeholder="https://" {...register('website')} />
          {errors.website && (
            <p role="alert" className="text-xs text-red-600">{errors.website.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vf-status">Status da parceria</Label>
          <Select
            id="vf-status"
            options={toOptions(partnershipStatusLabels)}
            {...register('partnershipStatus')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vf-level">Nível da parceria</Label>
          <Input id="vf-level" placeholder="Ex.: Gold Partner" {...register('partnershipLevel')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vf-start">Início da parceria</Label>
          <Input id="vf-start" type="date" {...register('partnershipStartDate')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vf-renewal">Renovação da parceria</Label>
          <Input id="vf-renewal" type="date" {...register('partnershipRenewalDate')} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="vf-notes">Observações</Label>
          <Textarea id="vf-notes" rows={3} {...register('notes')} />
        </div>
      </form>
    </Dialog>
  );
}
