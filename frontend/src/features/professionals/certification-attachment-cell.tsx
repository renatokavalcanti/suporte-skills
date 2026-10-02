import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Upload, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/toast';
import { professionalsService } from '@/services/professionals.service';
import { extractApiError } from '@/services/api';
import type { ProfessionalCertification } from '@/types/entities';
import { formatFileSize } from '@/utils/labels';

/**
 * Anexo do comprovante (D-025): o consultor (no proprio perfil) e a gestao
 * podem anexar/substituir/remover o PDF e abri-lo. O arquivo e' servido por
 * rota autenticada (nunca por URL publica).
 */
export function CertificationAttachmentCell({
  professionalId,
  record,
  canWrite,
}: {
  professionalId: string;
  record: ProfessionalCertification;
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [opening, setOpening] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['professional', professionalId, 'certifications'],
    });
    void queryClient.invalidateQueries({ queryKey: ['professional', professionalId] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      professionalsService.uploadAttachment(professionalId, record.id, file),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Comprovante anexado', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível anexar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const removeMutation = useMutation({
    mutationFn: () => professionalsService.removeAttachment(professionalId, record.id),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Comprovante removido', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível remover',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Formato inválido',
        description: 'Selecione um arquivo PDF.',
        variant: 'error',
      });
      return;
    }
    uploadMutation.mutate(file);
  };

  const openAttachment = async () => {
    setOpening(true);
    try {
      const blob = await professionalsService.fetchAttachment(professionalId, record.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast({
        title: 'Não foi possível abrir',
        description: extractApiError(error),
        variant: 'error',
      });
    } finally {
      setOpening(false);
    }
  };

  const busy = uploadMutation.isPending || removeMutation.isPending;

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFile}
      />

      {record.hasAttachment ? (
        <>
          <button
            type="button"
            onClick={() => void openAttachment()}
            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
            title={record.attachmentName ?? 'Abrir comprovante'}
          >
            {opening ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
            PDF
          </button>
          <span className="text-xs text-slate-400">
            {formatFileSize(record.attachmentSize)}
          </span>
          {canWrite && (
            <>
              <button
                type="button"
                aria-label="Substituir anexo"
                className="text-slate-400 hover:text-blue-600 disabled:opacity-50"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Remover anexo"
                className="text-slate-400 hover:text-red-500 disabled:opacity-50"
                disabled={busy}
                onClick={() => removeMutation.mutate()}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </>
      ) : canWrite ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50 dark:text-slate-400 dark:hover:text-blue-400"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Spinner className="h-3.5 w-3.5" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          Anexar PDF
        </button>
      ) : (
        <span className="text-slate-400">—</span>
      )}
    </div>
  );
}
