import type { ReactNode } from 'react';
import axios from 'axios';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { extractApiError } from '@/services/api';
import { cn } from '@/lib/utils';

export function LoadingState({
  label = 'Carregando...',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 text-slate-500 dark:text-slate-400',
        className,
      )}
    >
      <Spinner className="h-5 w-5" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Inbox className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {title}
        </p>
        {description && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  error,
  onRetry,
}: {
  message?: string;
  /** Quando informado, a mensagem e derivada do erro (403/404/validação). */
  error?: unknown;
  onRetry?: () => void;
}) {
  const text =
    message ?? messageFromError(error) ?? 'Não foi possível carregar os dados.';

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/50 dark:text-red-400">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">{text}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

function messageFromError(error: unknown): string | null {
  if (!error) return null;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 403) {
      return 'Você não tem permissão para acessar estas informações.';
    }
    if (status === 404) {
      return 'Registro não encontrado.';
    }
  }

  return extractApiError(error);
}
