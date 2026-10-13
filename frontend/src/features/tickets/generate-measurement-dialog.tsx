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
import { clientsService } from '@/services/clients.service';
import { measurementsService } from '@/services/measurements.service';
import { extractApiError } from '@/services/api';
import { MONTHS_PT, monthLabel } from './months';

const schema = z.object({
  clientId: z.string().min(1, 'Escolha o cliente'),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

type FormValues = z.infer<typeof schema>;

const now = new Date();
const emptyValues: FormValues = {
  clientId: '',
  year: now.getFullYear(),
  month: now.getMonth() + 1,
};

const monthOptions = MONTHS_PT.map((_, index) => ({
  value: String(index + 1),
  label: monthLabel(index + 1),
}));

export function GenerateMeasurementDialog({
  open,
  onClose,
}: {
  open: boolean;
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
    if (open) reset(emptyValues);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      measurementsService.generate({
        clientId: values.clientId,
        year: values.year,
        month: values.month,
      }),
    onSuccess: (measurement) => {
      void queryClient.invalidateQueries({ queryKey: ['measurements'] });
      toast({
        title: 'Rascunho gerado',
        description: `${measurement.ticketCount} chamado(s) no período.`,
        variant: 'success',
      });
      onClose();
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível gerar',
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
      title="Gerar medição mensal"
      description="Consolida os chamados faturados (encerrados no mês) do cliente selecionado. Gera um rascunho recalculável."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4 text-white" />}
            Gerar rascunho
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-3" onSubmit={submit} noValidate>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="gm-client">Cliente *</Label>
          <Select
            id="gm-client"
            placeholder="Escolha o cliente"
            options={clientOptions}
            {...register('clientId')}
          />
          {errors.clientId && (
            <p role="alert" className="text-xs text-red-600">{errors.clientId.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gm-month">Mês *</Label>
          <Select
            id="gm-month"
            options={monthOptions}
            {...register('month', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gm-year">Ano *</Label>
          <Input
            id="gm-year"
            type="number"
            min={2000}
            max={2100}
            {...register('year', { valueAsNumber: true })}
          />
        </div>
      </form>
    </Dialog>
  );
}
