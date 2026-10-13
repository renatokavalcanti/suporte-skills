import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/toast';
import { clientsService } from '@/services/clients.service';
import { extractApiError } from '@/services/api';
import type { Client } from '@/types/tickets';

const schema = z.object({
  name: z.string().min(1, 'Informe o nome do cliente'),
  document: z.string().optional(),
  zohoAccountId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = { name: '', document: '', zohoAccountId: '' };

export function ClientFormDialog({
  open,
  onClose,
  client,
}: {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(client);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  useEffect(() => {
    if (!open) return;
    if (client) {
      reset({
        name: client.name,
        document: client.document ?? '',
        zohoAccountId: client.zohoAccountId ?? '',
      });
    } else {
      reset(emptyValues);
    }
  }, [open, client, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name.trim(),
        document: values.document?.trim() || null,
        zohoAccountId: values.zohoAccountId?.trim() || null,
      };
      return client
        ? clientsService.update(client.id, payload)
        : clientsService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({
        title: isEditing ? 'Cliente atualizado' : 'Cliente criado',
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

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableClose={mutation.isPending}
      title={isEditing ? 'Editar cliente' : 'Novo cliente'}
      description="Cliente usado nas Medições Mensais. A conta do Zoho Desk liga os chamados ao cliente."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="h-4 w-4 text-white" />}
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4" onSubmit={submit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="cf-name">Nome *</Label>
          <Input id="cf-name" {...register('name')} />
          {errors.name && (
            <p role="alert" className="text-xs text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-document">CNPJ/NIF</Label>
          <Input id="cf-document" {...register('document')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-zoho">Id da conta no Zoho Desk</Label>
          <Input
            id="cf-zoho"
            placeholder="Ex.: 1234567890"
            {...register('zohoAccountId')}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Necessário para que os chamados do Zoho sejam vinculados automaticamente a este cliente.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
