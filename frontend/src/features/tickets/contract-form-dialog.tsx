import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/toast';
import { extractApiError } from '@/services/api';
import { clientsService } from '@/services/clients.service';
import { contractsService } from '@/services/contracts.service';
import type { Contract } from '@/types/reports';

const schema = z.object({
  clientId: z.string().min(1, 'Escolha o cliente'),
  planName: z.string().min(1, 'Informe o plano'),
  includedMinutes: z.number({ error: 'Informe um número' }).int().min(0),
  monthlyValue: z.number({ error: 'Informe um número' }).min(0),
  extraHourValue: z.number({ error: 'Informe um número' }).min(0),
  balancePolicy: z.enum(['EXPIRE', 'ACCUMULATE']),
  startDate: z.string().min(1, 'Informe o início da vigência'),
  endDate: z.string().optional(),
  financeEmail: z.string().optional(),
  active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const balanceOptions = [
  { value: 'EXPIRE', label: 'Expira (não acumula saldo)' },
  { value: 'ACCUMULATE', label: 'Acumula (soma o saldo dos meses)' },
];

const emptyValues: FormValues = {
  clientId: '',
  planName: '',
  includedMinutes: 0,
  monthlyValue: 0,
  extraHourValue: 0,
  balancePolicy: 'EXPIRE',
  startDate: '',
  endDate: '',
  financeEmail: '',
  active: true,
};

export function ContractFormDialog({
  open,
  contract,
  onClose,
}: {
  open: boolean;
  contract: Contract | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const clientsQuery = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => clientsService.list({ pageSize: 100, active: true }),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  useEffect(() => {
    if (!open) return;
    reset(
      contract
        ? {
            clientId: contract.clientId,
            planName: contract.planName,
            includedMinutes: contract.includedMinutes,
            monthlyValue: Number(contract.monthlyValue),
            extraHourValue: Number(contract.extraHourValue),
            balancePolicy: contract.balancePolicy,
            startDate: contract.startDate.slice(0, 10),
            endDate: contract.endDate ? contract.endDate.slice(0, 10) : '',
            financeEmail: contract.financeEmail ?? '',
            active: contract.active,
          }
        : emptyValues,
    );
  }, [open, contract, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        clientId: values.clientId,
        planName: values.planName,
        includedMinutes: values.includedMinutes,
        monthlyValue: values.monthlyValue,
        extraHourValue: values.extraHourValue,
        balancePolicy: values.balancePolicy,
        startDate: values.startDate,
        endDate: values.endDate || undefined,
        financeEmail: values.financeEmail?.trim() || undefined,
        active: values.active,
      };
      return contract
        ? contractsService.update(contract.id, payload)
        : contractsService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: contract ? 'Contrato atualizado' : 'Contrato criado',
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

  const clientOptions =
    clientsQuery.data?.data.map((client) => ({
      value: client.id,
      label: client.name,
    })) ?? [];

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableClose={mutation.isPending}
      size="lg"
      title={contract ? 'Editar contrato' : 'Novo contrato'}
      description="Franquia, valores e política de saldo usados no faturamento."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4 text-white" />}
            Salvar
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-client">Cliente *</Label>
          <Select id="c-client" placeholder="Escolha o cliente" options={clientOptions} {...register('clientId')} />
          {errors.clientId && <p role="alert" className="text-xs text-red-600">{errors.clientId.message}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-plan">Plano *</Label>
          <Input id="c-plan" {...register('planName')} />
          {errors.planName && <p role="alert" className="text-xs text-red-600">{errors.planName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-min">Franquia (minutos) *</Label>
          <Input id="c-min" type="number" min={0} {...register('includedMinutes', { valueAsNumber: true })} />
          {errors.includedMinutes && <p role="alert" className="text-xs text-red-600">{errors.includedMinutes.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-policy">Política de saldo</Label>
          <Select id="c-policy" options={balanceOptions} {...register('balancePolicy')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-monthly">Valor mensal (R$)</Label>
          <Input id="c-monthly" type="number" step="0.01" min={0} {...register('monthlyValue', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-extra">Valor hora adicional (R$)</Label>
          <Input id="c-extra" type="number" step="0.01" min={0} {...register('extraHourValue', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-start">Vigência — início *</Label>
          <Input id="c-start" type="date" {...register('startDate')} />
          {errors.startDate && <p role="alert" className="text-xs text-red-600">{errors.startDate.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-end">Vigência — fim</Label>
          <Input id="c-end" type="date" {...register('endDate')} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="c-email">E-mail financeiro (destino do relatório)</Label>
          <Input id="c-email" type="email" {...register('financeEmail')} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('active')} />
          Contrato ativo
        </label>
      </form>
    </Dialog>
  );
}
