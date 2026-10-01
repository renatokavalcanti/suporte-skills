import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Circle,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/toast';
import { newsService } from '@/services/news.service';
import { extractApiError } from '@/services/api';
import type { NewsDigestHighlight } from '@/types/entities';
import { cn } from '@/lib/utils';
import {
  formatDateTime,
  newsFocusLabels,
  newsFocusVariant,
} from '@/utils/labels';

interface NewsDigestPanelProps {
  canWrite: boolean;
}

export function NewsDigestPanel({ canWrite }: NewsDigestPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['news', 'digest'],
    queryFn: () => newsService.getDigest(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['news'] });

  const generate = useMutation({
    mutationFn: () => newsService.generateDigest(),
    onSuccess: (digest) => {
      void invalidate();
      toast({
        title: 'Resumo atualizado',
        description: `${digest.highlights.length} destaque(s) selecionado(s).`,
        variant: 'success',
      });
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível gerar o resumo',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  const toggleState = useMutation({
    mutationFn: ({
      id,
      read,
      saved,
    }: {
      id: string;
      read: boolean;
      saved: boolean;
    }) => Promise.all([newsService.setRead(id, read), newsService.setSaved(id, saved)]),
    onSuccess: () => void invalidate(),
    onError: (error) =>
      toast({
        title: 'Não foi possível atualizar',
        description: extractApiError(error),
        variant: 'error',
      }),
  });

  if (isLoading) return null;

  const aiEnabled = data?.aiEnabled ?? false;
  const digest = data?.digest ?? null;

  // Sem resumo e sem permissão de gerar: não ocupa espaço na tela do consultor.
  if (!digest && !canWrite) return null;

  if (!digest) {
    return (
      <Card className="mb-4 border-dashed p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Destaques para o consultor
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {aiEnabled
                  ? 'Nenhum resumo gerado ainda. Gere para ver as novidades mais importantes.'
                  : 'Resumo inteligente desativado. Configure AI_ENABLED e AI_API_KEY para ativar.'}
              </p>
            </div>
          </div>
          {canWrite && (
            <Button
              size="sm"
              onClick={() => generate.mutate()}
              disabled={!aiEnabled || generate.isPending}
            >
              {generate.isPending ? (
                <Spinner className="h-4 w-4 text-white" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Gerar resumo
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {digest.title}
              </p>
              <Badge variant="info">
                {digest.highlights.length} destaque(s)
              </Badge>
              <span className="text-xs text-slate-400">
                {formatDateTime(digest.createdAt)}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-700 dark:text-slate-300">
              {digest.summary}
            </p>
          </div>
        </div>
        {canWrite && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => generate.mutate()}
            disabled={!aiEnabled || generate.isPending}
          >
            <RefreshCw
              className={cn('h-4 w-4', generate.isPending && 'animate-spin')}
            />
            Gerar novamente
          </Button>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {digest.highlights.map((highlight) => (
          <DigestHighlightRow
            key={highlight.id}
            highlight={highlight}
            onToggleRead={() =>
              toggleState.mutate({
                id: highlight.id,
                read: !highlight.read,
                saved: highlight.saved,
              })
            }
            onToggleSaved={() =>
              toggleState.mutate({
                id: highlight.id,
                read: highlight.read,
                saved: !highlight.saved,
              })
            }
          />
        ))}
      </ul>

      {digest.model && (
        <p className="mt-3 text-right text-xs text-slate-400">
          Resumo gerado por IA ({digest.model})
          {digest.origin === 'sync' ? ' na sincronização automática' : ''}
        </p>
      )}
    </Card>
  );
}

function DigestHighlightRow({
  highlight,
  onToggleRead,
  onToggleSaved,
}: {
  highlight: NewsDigestHighlight;
  onToggleRead: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <li
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border border-transparent bg-white/70 p-3 dark:bg-slate-900/40',
        !highlight.read && 'border-l-4 border-l-blue-500',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {highlight.focus && (
            <Badge variant={newsFocusVariant[highlight.focus]}>
              {newsFocusLabels[highlight.focus]}
            </Badge>
          )}
          {highlight.vendor && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {highlight.vendor}
              {highlight.technology ? ` · ${highlight.technology}` : ''}
            </span>
          )}
        </div>
        <a
          href={highlight.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline dark:text-slate-100 dark:hover:text-blue-300"
        >
          {highlight.title}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {highlight.note}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleRead}
          aria-label={highlight.read ? 'Marcar como não lida' : 'Marcar como lida'}
        >
          {highlight.read ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSaved}
          aria-label={highlight.saved ? 'Remover dos salvos' : 'Salvar'}
        >
          {highlight.saved ? (
            <BookmarkCheck className="h-4 w-4 text-blue-600" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </Button>
      </div>
    </li>
  );
}
