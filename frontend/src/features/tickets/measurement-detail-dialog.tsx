import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, Lock, Unlock } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ErrorState, LoadingState } from '@/components/feedback';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { measurementsService } from '@/services/measurements.service';
import { extractApiError } from '@/services/api';
import { formatDate } from '@/utils/labels';
import { periodLabel } from './months';

export function MeasurementDetailDialog({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canWrite, isAdmin } = usePermissions();
  const [justification, setJustification] = useState('');
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null);

  useEffect(() => {
    setJustification('');
  }, [id]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['measurements', 'detail', id],
    queryFn: () => measurementsService.get(id as string),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['measurements'] });
  };

  const closeMutation = useMutation({
    mutationFn: () => measurementsService.close(id as string),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Medição fechada', variant: 'success' });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível fechar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const reopenMutation = useMutation({
    mutationFn: () => measurementsService.reopen(id as string, justification.trim()),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Medição reaberta', variant: 'success' });
      setJustification('');
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível reabrir',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const pending = closeMutation.isPending || reopenMutation.isPending;
  const isClosed = data?.status === 'CLOSED';

  const download = async (kind: 'csv' | 'pdf') => {
    if (!id) return;
    try {
      setDownloading(kind);
      const { blob, filename } =
        kind === 'csv'
          ? await measurementsService.exportCsv(id)
          : await measurementsService.exportPdf(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Não foi possível exportar',
        description: extractApiError(error),
        variant: 'error',
      });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog
      open={Boolean(id)}
      onClose={onClose}
      disableClose={pending}
      title={data ? `Medição — ${data.client.name}` : 'Medição'}
      description={data ? periodLabel(data.year, data.month) : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Fechar
          </Button>
          {data && canWrite && !isClosed && (
            <Button
              onClick={() => closeMutation.mutate()}
              disabled={pending}
            >
              {closeMutation.isPending ? (
                <Spinner className="h-4 w-4 text-white" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Fechar medição
            </Button>
          )}
          {data && isClosed && isAdmin && (
            <Button
              onClick={() => reopenMutation.mutate()}
              disabled={pending || justification.trim().length < 3}
            >
              {reopenMutation.isPending ? (
                <Spinner className="h-4 w-4 text-white" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
              Reabrir
            </Button>
          )}
        </>
      }
    >
      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState
          message="Não foi possível carregar a medição."
          onRetry={() => void refetch()}
        />
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isClosed ? 'success' : 'warning'}>
              {isClosed ? 'Fechada' : 'Rascunho'}
            </Badge>
            <Badge variant="info">{data.ticketCount} chamado(s)</Badge>
            <Badge variant="neutral">{data.timeSpentMinutes} min</Badge>
            <Badge variant="neutral">
              SLA {data.slaPercentage === null ? '—' : `${data.slaPercentage}%`}
            </Badge>
            {data.closedAt && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Fechada em {formatDate(data.closedAt)}
              </span>
            )}
          </div>

          {isClosed && canWrite && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Exportar:</span>
              <Button
                variant="outline"
                size="sm"
                disabled={downloading !== null}
                onClick={() => void download('csv')}
              >
                {downloading === 'csv' ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={downloading !== null}
                onClick={() => void download('pdf')}
              >
                {downloading === 'pdf' ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                PDF
              </Button>
            </div>
          )}

          {isClosed && isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="md-justification">Justificativa da reabertura</Label>
              <Textarea
                id="md-justification"
                rows={2}
                placeholder="Obrigatória — fica registrada na auditoria."
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
              />
            </div>
          )}

          <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Encerrado em</TableHead>
                  <TableHead className="text-right">Min.</TableHead>
                  <TableHead>SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {item.ticketNumber ?? item.zohoTicketId}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate">
                      {item.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{item.status}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(item.closeDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.timeSpentMinutes}
                    </TableCell>
                    <TableCell>
                      {item.slaCompliant === null ? (
                        <Badge variant="neutral">—</Badge>
                      ) : item.slaCompliant ? (
                        <Badge variant="success">Conforme</Badge>
                      ) : (
                        <Badge variant="danger">Violado</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(data.items ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
                      Nenhum chamado no período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </Dialog>
  );
}
