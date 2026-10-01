import { useState } from 'react';
import { CheckCircle2, Download, FileUp, Upload } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { useToast } from '@/components/toast';
import { importsService } from '@/services/imports.service';
import { extractApiError } from '@/services/api';
import type {
  ImportCommitResult,
  ImportPreview,
  ImportType,
} from '@/types/entities';

const templates: Record<ImportType, { filename: string; content: string }> = {
  professionals: {
    filename: 'modelo-profissionais.csv',
    content:
      'name,email,position,professional_type,seniority\nJoao Silva,joao.silva@suporte.local,Analista de Infraestrutura,CLT,JUNIOR\n',
  },
  certifications: {
    filename: 'modelo-certificacoes.csv',
    content:
      'professional_email,vendor,certification,obtained_at,expires_at,certificate_number\njoao.silva@suporte.local,Red Hat,Red Hat Certified Engineer (RHCE),2026-01-01,2029-01-01,CERT-123\n',
  },
};

function downloadText(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ImportsPage() {
  const { toast } = useToast();
  const [type, setType] = useState<ImportType>('professionals');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAction, setFailedAction] = useState<'preview' | 'commit' | null>(
    null,
  );

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setFailedAction(null);
  };

  const onSelectFile = async (selected: File | null): Promise<void> => {
    setResult(null);
    setPreview(null);
    setError(null);
    setFile(selected);
    if (!selected) return;

    setBusy(true);
    try {
      const data = await importsService.preview(type, selected);
      setPreview(data);
      setFailedAction(null);
    } catch (err) {
      setError(extractApiError(err));
      setFailedAction('preview');
    } finally {
      setBusy(false);
    }
  };

  const onCommit = async (): Promise<void> => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await importsService.commit(type, file);
      setResult(data);
      setPreview(null);
      setFailedAction(null);
      toast({
        title: 'Importação concluída',
        description: `${data.imported} registro(s) importado(s).`,
        variant: 'success',
      });
    } catch (err) {
      setError(extractApiError(err));
      setFailedAction('commit');
    } finally {
      setBusy(false);
    }
  };

  const retryFailedAction = (): void => {
    setError(null);
    if (failedAction === 'commit') {
      void onCommit();
    } else {
      void onSelectFile(file);
    }
  };

  const switchType = (value: string) => {
    setType(value as ImportType);
    reset();
  };

  return (
    <>
      <PageHeader
        title="Importação de dados"
        description="Importe profissionais ou certificações a partir de um arquivo CSV."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadText(templates[type].filename, templates[type].content)
            }
          >
            <Download className="h-4 w-4" />
            Baixar modelo
          </Button>
        }
      />

      <div className="mb-4">
        <Tabs
          value={type}
          onChange={switchType}
          tabs={[
            { value: 'professionals', label: 'Profissionais' },
            { value: 'certifications', label: 'Certificações' },
          ]}
        />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>1. Envie o arquivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-6 py-8 text-center hover:border-blue-400 dark:border-slate-700">
            <FileUp className="h-6 w-6 text-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {file ? file.name : 'Clique para selecionar um arquivo .csv'}
            </span>
            <span className="text-xs text-slate-400">
              Separador “,” ou “;” · até 2 MB · 1000 linhas
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) =>
                void onSelectFile(event.target.files?.[0] ?? null)
              }
            />
          </label>

          {preview && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">Total: {preview.total}</Badge>
              <Badge variant="success">Válidos: {preview.valid}</Badge>
              <Badge variant={preview.invalid > 0 ? 'danger' : 'neutral'}>
                Inválidos: {preview.invalid}
              </Badge>
              <Button
                className="ml-auto"
                onClick={() => void onCommit()}
                disabled={busy || preview.valid === 0}
              >
                <Upload className="h-4 w-4" />
                Confirmar importação ({preview.valid})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {busy && (
        <Card>
          <LoadingState label="Processando arquivo..." />
        </Card>
      )}

      {error && (
        <Card className="mb-4">
          <ErrorState
            message={error}
            onRetry={file ? retryFailedAction : undefined}
          />
        </Card>
      )}

      {result && (
        <Card className="mb-4 border-emerald-200 dark:border-emerald-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Importação concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-slate-600 dark:text-slate-300">
              {result.imported} importado(s) · {result.skipped} ignorado(s) ·{' '}
              {result.total} linha(s) no arquivo.
            </p>
            {result.errors.length > 0 && (
              <ul className="list-inside list-disc text-xs text-red-600 dark:text-red-400">
                {result.errors.map((item) => (
                  <li key={item.line}>
                    Linha {item.line}: {item.errors.join('; ')}
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" onClick={reset}>
              Importar outro arquivo
            </Button>
          </CardContent>
        </Card>
      )}

      {preview && !busy && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>2. Revise a validação</CardTitle>
          </CardHeader>
          {preview.rows.length === 0 ? (
            <EmptyState title="Nenhuma linha encontrada" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Situação</TableHead>
                  {preview.columns.map((column) => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                  <TableHead>Erros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow key={row.line}>
                    <TableCell>{row.line}</TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === 'valid' ? 'success' : 'danger'}
                      >
                        {row.status === 'valid' ? 'Válida' : 'Inválida'}
                      </Badge>
                    </TableCell>
                    {preview.columns.map((column) => (
                      <TableCell key={column.key}>
                        {row.data[column.key] || '—'}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs text-red-600 dark:text-red-400">
                      {row.errors.length > 0 ? row.errors.join('; ') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
