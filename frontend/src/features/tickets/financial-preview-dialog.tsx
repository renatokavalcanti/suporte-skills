import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, Download, Send } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { LoadingState } from '@/components/feedback';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { extractApiError } from '@/services/api';
import { ticketReportsService } from '@/services/ticket-reports.service';
import type { PeriodParams } from '@/types/reports';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FinancialPreviewDialog({
  open,
  params,
  onClose,
  onSent,
}: {
  open: boolean;
  params: PeriodParams | null;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { toast } = useToast();
  const [recipients, setRecipients] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ticket-reports', 'financial', params],
    queryFn: () => ticketReportsService.financialPreview(params as PeriodParams),
    enabled: open && Boolean(params),
  });

  useEffect(() => {
    if (data) setRecipients(data.to);
  }, [data]);

  const eml = useMutation({
    mutationFn: () => ticketReportsService.financialEml(params as PeriodParams),
    onSuccess: ({ blob, filename }) => downloadBlob(blob, filename),
    onError: (error) =>
      toast({ title: 'Não foi possível gerar o .eml', description: extractApiError(error), variant: 'error' }),
  });

  const send = useMutation({
    mutationFn: () =>
      ticketReportsService.sendFinancial({
        ...(params as PeriodParams),
        clientId: params?.clientId as string,
        type: 'FINANCIAL',
        recipients: recipients.trim() || undefined,
        confirm: true,
      }),
    onSuccess: (result) => {
      setConfirmOpen(false);
      toast({
        title: 'Relatório enviado',
        description: `Para: ${result.sentTo.join(', ')}`,
        variant: 'success',
      });
      onSent?.();
      onClose();
    },
    onError: (error) =>
      toast({ title: 'Falha no envio', description: extractApiError(error), variant: 'error' }),
  });

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(
        `${data.subject}\n\n${data.text}`,
      );
      toast({ title: 'Copiado', variant: 'success' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'error' });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      disableClose={send.isPending}
      size="lg"
      title="Relatório Financeiro (e-mail)"
      description="Pré-visualização do e-mail de liberação de faturamento. O envio exige confirmação."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>
            Fechar
          </Button>
          <Button variant="outline" onClick={() => copy()} disabled={!data}>
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button
            variant="outline"
            onClick={() => eml.mutate()}
            disabled={!data || eml.isPending}
          >
            {eml.isPending ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            Baixar .eml
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={!data || send.isPending}>
            {send.isPending ? <Spinner className="h-4 w-4 text-white" /> : <Send className="h-4 w-4" />}
            Enviar
          </Button>
        </>
      }
    >
      {isLoading || !data ? (
        <LoadingState label="Gerando prévia do e-mail..." />
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{data.subject}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fp-to">Destinatários (separados por vírgula)</Label>
            <Input
              id="fp-to"
              value={recipients}
              placeholder="financeiro@cliente.com"
              onChange={(e) => setRecipients(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Corpo do e-mail</Label>
            <iframe
              title="Pré-visualização do e-mail"
              srcDoc={data.html}
              className="h-80 w-full rounded-md border border-slate-200 dark:border-slate-800"
              sandbox=""
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Anexo: {data.attachmentFileName}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar envio"
        description={recipients ? `Enviar o relatório para ${recipients}?` : undefined}
        note="O e-mail será enviado agora e o envio será registrado para auditoria."
        confirmLabel="Enviar agora"
        loading={send.isPending}
        onConfirm={() => send.mutate()}
        onClose={() => setConfirmOpen(false)}
      />
    </Dialog>
  );
}
