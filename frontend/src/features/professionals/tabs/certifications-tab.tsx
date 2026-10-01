import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/feedback';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CertificationStatusBadge } from '@/components/certification-status-badge';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { professionalsService } from '@/services/professionals.service';
import { extractApiError } from '@/services/api';
import type { ProfessionalCertification } from '@/types/entities';
import { ProfessionalCertificationFormDialog } from '../professional-certification-form-dialog';
import { certificationLevelLabels, formatDate, formatDaysRemaining } from '@/utils/labels';

export function CertificationsTab({ professionalId }: { professionalId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEditProfessional } = usePermissions();
  const canWrite = canEditProfessional(professionalId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProfessionalCertification | null>(null);
  const [removing, setRemoving] = useState<ProfessionalCertification | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['professional', professionalId, 'certifications'],
    queryFn: () => professionalsService.certifications(professionalId),
  });

  const removeMutation = useMutation({
    mutationFn: (recordId: string) =>
      professionalsService.removeCertification(professionalId, recordId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['professional', professionalId] });
      toast({ title: 'Vinculação removida', variant: 'success' });
      setRemoving(null);
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível remover',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  return (
    <>
      {canWrite && (
        <div className="mb-3 flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Vincular certificação
          </Button>
        </div>
      )}

      <Card className="overflow-hidden">
        {isLoading && <TableSkeleton rows={4} />}
        {isError && (
          <ErrorState
            message="Não foi possível carregar as certificações."
            onRetry={() => void refetch()}
          />
        )}
        {data && data.length === 0 && (
          <EmptyState
            title="Nenhuma certificação vinculada"
            description="Vincule a primeira certificação deste profissional."
          />
        )}

        {data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificação</TableHead>
                <TableHead>Fabricante</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Obtenção</TableHead>
                <TableHead>Expiração</TableHead>
                <TableHead>Restante</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {record.certification.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {record.certification.code && <span>{record.certification.code}</span>}
                      {record.proofUrl && (
                        <a
                          href={record.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                        >
                          comprovação
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{record.certification.vendor.name}</TableCell>
                  <TableCell>
                    {record.certification.level
                      ? certificationLevelLabels[record.certification.level]
                      : '—'}
                  </TableCell>
                  <TableCell>{formatDate(record.obtainedAt)}</TableCell>
                  <TableCell>{formatDate(record.expiresAt)}</TableCell>
                  <TableCell>{formatDaysRemaining(record.daysRemaining)}</TableCell>
                  <TableCell>
                    <CertificationStatusBadge status={record.status} />
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar"
                          onClick={() => {
                            setEditing(record);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover"
                          onClick={() => setRemoving(record)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ProfessionalCertificationFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        professionalId={professionalId}
        record={editing}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remover vinculação"
        description={
          removing
            ? `Remover ${removing.certification.name} deste profissional?`
            : undefined
        }
        confirmLabel="Remover"
        destructive
        reversible={false}
        loading={removeMutation.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removeMutation.mutate(removing.id);
        }}
      />
    </>
  );
}
