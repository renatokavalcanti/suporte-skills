import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/toast';
import { roadmapService } from '@/services/roadmap.service';
import { professionalsService } from '@/services/professionals.service';
import { certificationsService } from '@/services/certifications.service';
import { technologiesService } from '@/services/technologies.service';
import { vendorsService } from '@/services/vendors.service';
import { extractApiError } from '@/services/api';
import type { RoadmapItem } from '@/types/entities';
import {
  roadmapPriorityLabels,
  roadmapStatusLabels,
  roadmapTypeLabels,
  toDateInput,
  toOptions,
} from '@/utils/labels';

const schema = z.object({
  professionalId: z.string().min(1, 'Selecione o profissional'),
  title: z.string().min(1, 'Informe o objetivo'),
  objective: z.string().optional(),
  type: z.string().min(1),
  priority: z.string().min(1),
  status: z.string().min(1),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  vendorId: z.string().optional(),
  certificationId: z.string().optional(),
  technologyId: z.string().optional(),
  ownerId: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  professionalId: '',
  title: '',
  objective: '',
  type: 'CERTIFICATION',
  priority: 'MEDIUM',
  status: 'BACKLOG',
  startDate: '',
  dueDate: '',
  vendorId: '',
  certificationId: '',
  technologyId: '',
  ownerId: '',
  notes: '',
};

export function RoadmapFormDialog({
  open,
  onClose,
  item,
  defaultProfessionalId,
  mode = 'global',
}: {
  open: boolean;
  onClose: () => void;
  item?: RoadmapItem | null;
  defaultProfessionalId?: string;
  /**
   * `profile`: usado na aba de roadmap do perfil (D-026) — o profissional e
   * fixo e as rotas aninhadas aplicam o escopo do CONSULTANT. `global` (padrao)
   * usa as rotas de gestao `/roadmap`.
   */
  mode?: 'global' | 'profile';
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = Boolean(item);
  const isProfile = mode === 'profile';
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });

  const vendorId = useWatch({ control, name: 'vendorId' });

  const { data: professionals } = useQuery({
    queryKey: ['professionals', 'options', 'active'],
    queryFn: () => professionalsService.list({ pageSize: 200, active: true, sort: 'name' }),
    enabled: open,
  });
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
  const { data: technologies } = useQuery({
    queryKey: ['technologies', 'options', vendorId],
    queryFn: () => technologiesService.list({ vendorId, pageSize: 200, sort: 'name' }),
    enabled: open && Boolean(vendorId),
  });

  const professionalOptions = useMemo(
    () => (professionals?.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [professionals],
  );
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
  const technologyOptions = useMemo(
    () => (technologies?.data ?? []).map((t) => ({ value: t.id, label: t.name })),
    [technologies],
  );

  useEffect(() => {
    if (!open) return;
    setAttachment(null);
    if (item) {
      reset({
        professionalId: item.professionalId,
        title: item.title,
        objective: item.objective ?? '',
        type: item.type,
        priority: item.priority,
        status: item.status,
        startDate: toDateInput(item.startDate),
        dueDate: toDateInput(item.dueDate),
        vendorId: item.certification?.vendor.id ?? item.technology?.vendor.id ?? '',
        certificationId: item.certificationId ?? '',
        technologyId: item.technologyId ?? '',
        ownerId: item.ownerId ?? '',
        notes: item.notes ?? '',
      });
    } else {
      reset({ ...emptyValues, professionalId: defaultProfessionalId ?? '' });
    }
  }, [open, item, defaultProfessionalId, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const base = {
        title: values.title.trim(),
        objective: values.objective?.trim() || null,
        type: values.type,
        priority: values.priority,
        status: values.status,
        startDate: values.startDate || null,
        dueDate: values.dueDate || null,
        certificationId: values.certificationId || null,
        technologyId: values.technologyId || null,
        notes: values.notes?.trim() || null,
      };

      let saved: RoadmapItem;
      if (isProfile) {
        saved = item
          ? await professionalsService.updateRoadmap(
              values.professionalId,
              item.id,
              base,
            )
          : await professionalsService.createRoadmap(values.professionalId, base);
      } else {
        const payload = {
          ...base,
          professionalId: values.professionalId,
          ownerId: values.ownerId || null,
        };
        saved = item
          ? await roadmapService.update(item.id, payload)
          : await roadmapService.create(payload);
      }

      // Anexo (D-026): enviado logo apos salvar o item (cadastro ou edicao).
      if (attachment) {
        saved = await professionalsService.uploadRoadmapAttachment(
          saved.professionalId,
          saved.id,
          attachment,
        );
      }
      return saved;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roadmap'] });
      void queryClient.invalidateQueries({ queryKey: ['professional'] });
      toast({
        title: isEditing ? 'Item atualizado' : 'Item criado',
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
      title={isEditing ? 'Editar item de roadmap' : 'Novo item de roadmap'}
      description="Objetivo de desenvolvimento do profissional."
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
        {!isProfile && (
          <div className="space-y-1.5">
            <Label htmlFor="rf-prof">Profissional *</Label>
            <Select
              id="rf-prof"
              placeholder="Selecione"
              options={professionalOptions}
              {...register('professionalId')}
            />
            {errors.professionalId && (
              <p role="alert" className="text-xs text-red-600">{errors.professionalId.message}</p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="rf-type">Tipo *</Label>
          <Select id="rf-type" options={toOptions(roadmapTypeLabels)} {...register('type')} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rf-title">Objetivo *</Label>
          <Input id="rf-title" {...register('title')} />
          {errors.title && (
            <p role="alert" className="text-xs text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-priority">Prioridade</Label>
          <Select
            id="rf-priority"
            options={toOptions(roadmapPriorityLabels)}
            {...register('priority')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-status">Status</Label>
          <Select
            id="rf-status"
            options={toOptions(roadmapStatusLabels)}
            {...register('status')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-start">Início</Label>
          <Input id="rf-start" type="date" {...register('startDate')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-due">Prazo</Label>
          <Input id="rf-due" type="date" {...register('dueDate')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-vendor">Fabricante</Label>
          <Select
            id="rf-vendor"
            placeholder="Opcional"
            disabled={vendorsLoading || vendorsError}
            options={vendorOptions}
            {...register('vendorId', {
              onChange: () => {
                setValue('certificationId', '');
                setValue('technologyId', '');
              },
            })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-cert">Certificação</Label>
          <Select
            id="rf-cert"
            placeholder="Opcional"
            options={certificationOptions}
            disabled={!vendorId}
            {...register('certificationId')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-tech">Tecnologia</Label>
          <Select
            id="rf-tech"
            placeholder="Opcional"
            options={technologyOptions}
            disabled={!vendorId}
            {...register('technologyId')}
          />
          <p className="text-[11px] text-slate-400">
            Se vazio e houver certificação, a tecnologia é derivada dela.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rf-owner">Responsável</Label>
          <Select
            id="rf-owner"
            placeholder="Opcional"
            options={professionalOptions}
            {...register('ownerId')}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rf-objective">Descrição curta</Label>
          <Input id="rf-objective" {...register('objective')} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rf-notes">Observações</Label>
          <Textarea id="rf-notes" rows={2} {...register('notes')} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="rf-attachment">Comprovante (PDF)</Label>
          <input
            id="rf-attachment"
            ref={attachmentInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = '';
              if (file && file.type !== 'application/pdf') {
                toast({
                  title: 'Formato inválido',
                  description: 'Selecione um arquivo PDF.',
                  variant: 'error',
                });
                return;
              }
              setAttachment(file);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => attachmentInputRef.current?.click()}
            >
              <Paperclip className="h-3.5 w-3.5" />
              {attachment || item?.hasAttachment ? 'Substituir arquivo' : 'Selecionar arquivo'}
            </Button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {attachment
                ? attachment.name
                : item?.hasAttachment
                  ? `Anexo atual: ${item.attachmentName}`
                  : 'Opcional'}
            </span>
            {attachment && (
              <button
                type="button"
                className="text-slate-400 hover:text-red-500"
                aria-label="Remover arquivo selecionado"
                onClick={() => setAttachment(null)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
