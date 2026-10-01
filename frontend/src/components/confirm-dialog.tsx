import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function ConfirmDialog({
  open,
  title,
  description,
  note,
  reversible = true,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  /** Texto explicativo customizado (substitui a observacao padrao). */
  note?: string;
  /** Desativacao/reativacao (reversivel) x remocao definitiva. */
  reversible?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const explanation =
    note ??
    (reversible
      ? 'Esta ação pode ser revertida reativando o registro posteriormente.'
      : 'Esta ação não pode ser desfeita.');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      disableClose={loading}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner className="h-4 w-4 text-white" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{explanation}</p>
    </Dialog>
  );
}

/** Hook utilitário para controlar estado simples de abertura. */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  return {
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    setOpen,
  };
}
