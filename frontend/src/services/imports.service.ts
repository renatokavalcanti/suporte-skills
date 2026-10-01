import { api } from './api';
import type {
  ImportCommitResult,
  ImportPreview,
  ImportType,
} from '@/types/entities';

async function upload<T>(
  type: ImportType,
  action: 'preview' | 'commit',
  file: File,
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<T>(`/imports/${type}/${action}`, form);
  return data;
}

export const importsService = {
  preview: (type: ImportType, file: File) =>
    upload<ImportPreview>(type, 'preview', file),
  commit: (type: ImportType, file: File) =>
    upload<ImportCommitResult>(type, 'commit', file),
};
