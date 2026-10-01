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
import { usePermissions } from '@/hooks/use-permissions';
import { professionalsService } from '@/services/professionals.service';
import { extractApiError } from '@/services/api';
import type { Professional } from '@/types/entities';
import {
  professionalTypeLabels,
  seniorityLabels,
  roleLabels,
  toOptions,
  toDateInput,
} from '@/utils/labels';

const schema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  email: z
    .string()
    .min(1, 'Informe o e-mail')
    .refine((value) => /^\S+@\S+\.\S+$/.test(value), 'E-mail inválido'),
  position: z.string().optional(),
  professionalType: z.string().optional(),
  seniority: z.string().optional(),
  hireDate: z.string().optional(),
  role: z.string().optional(),
  password: z
    .string()
    .optional()
    .refine(
      (value) => !value || value.length >= 6,
      'A senha deve ter ao menos 6 caracteres',
    ),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  name: '',
  email: '',
  position: '',
  professionalType: '',
  seniority: '',
  hireDate: '',
  role: 'CONSULTANT',
  password: '',
  notes: '',
  active: true,
};

export function ProfessionalFormDialog({
  open,
  onClose,
  professional,
}: {
  open: boolean;
  onClose: () => void;
  professional?: Professional | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const isEditing = Boolean(professional);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    if (professional) {
      reset({
        name: professional.name,
        email: professional.email,
        position: professional.position ?? '',
        professionalType: professional.professionalType ?? '',
        seniority: professional.seniority ?? '',
        hireDate: toDateInput(professional.hireDate),
        role: professional.role,
        password: '',
        notes: professional.notes ?? '',
        active: professional.active,
      });
    } else {
      reset(emptyValues);
    }
  }, [open, professional, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        position: values.position?.trim() || null,
        professionalType: (values.professionalType || null) as never,
        seniority: (values.seniority || null) as never,
        hireDate: values.hireDate || null,
        notes: values.notes?.trim() || null,
        ...(isAdmin ? { role: values.role || undefined } : {}),
        ...(isAdmin && values.password ? { password: values.password } : {}),
        active: values.active ?? true,
      };
      if (professional) {
        return professionalsService.update(professional.id, payload);
      }
      return professionalsService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['professionals'] });
      if (professional) {
        void queryClient.invalidateQueries({
          queryKey: ['professional', professional.id],
        });
      }
      toast({
        title: isEditing ? 'Profissional atualizado' : 'Profissional criado',
        variant: 'success',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível salvar',
        description: extractApiError(error),
        variant: 'error',
      });
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableClose={mutation.isPending}
      title={isEditing ? 'Editar profissional' : 'Novo profissional'}
      description="Dados cadastrais e de acesso do profissional."
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
          <Label htmlFor="pf-name">Nome *</Label>
          <Input id="pf-name" {...register('name')} />
          {errors.name && (
            <p role="alert" className="text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf-email">E-mail *</Label>
          <Input id="pf-email" type="email" {...register('email')} />
          {errors.email && (
            <p role="alert" className="text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf-position">Cargo</Label>
          <Input id="pf-position" {...register('position')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf-type">Tipo</Label>
          <Select
            id="pf-type"
            placeholder="Não informado"
            options={toOptions(professionalTypeLabels)}
            {...register('professionalType')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf-seniority">Senioridade</Label>
          <Select
            id="pf-seniority"
            placeholder="Não informado"
            options={toOptions(seniorityLabels)}
            {...register('seniority')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf-hire">Data de admissão</Label>
          <Input id="pf-hire" type="date" {...register('hireDate')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pf-active">Situação</Label>
          <Select
            id="pf-active"
            options={[
              { value: 'true', label: 'Ativo' },
              { value: 'false', label: 'Inativo' },
            ]}
            {...register('active', {
              setValueAs: (value) => value === 'true' || value === true,
            })}
          />
        </div>

        {isAdmin && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="pf-role">Papel de acesso</Label>
              <Select
                id="pf-role"
                options={toOptions(roleLabels)}
                {...register('role')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-password">
                {isEditing ? 'Nova senha (opcional)' : 'Senha (opcional)'}
              </Label>
              <Input
                id="pf-password"
                type="password"
                autoComplete="new-password"
                placeholder="Deixe em branco para não alterar"
                {...register('password')}
              />
              {errors.password && (
                <p role="alert" className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>
          </>
        )}

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pf-notes">Observações</Label>
          <Textarea id="pf-notes" rows={3} {...register('notes')} />
        </div>
      </form>
    </Dialog>
  );
}
