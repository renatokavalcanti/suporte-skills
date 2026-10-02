import { BadRequestException } from '@nestjs/common';
import { basename } from 'node:path';

/**
 * Validacao e saneamento do anexo PDF (D-025/D-026), compartilhados entre os
 * vínculos de certificacao e os itens de roadmap.
 */
export function assertPdfUpload(
  file: Express.Multer.File | undefined,
  maxBytes: number,
): void {
  if (!file || !file.buffer || file.size === 0) {
    throw new BadRequestException('Envie um arquivo PDF');
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    throw new BadRequestException(`O arquivo excede o limite de ${mb} MB`);
  }
  const isPdfMime = file.mimetype === 'application/pdf';
  const isPdfMagic = file.buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  if (!isPdfMime || !isPdfMagic) {
    throw new BadRequestException('O anexo deve ser um arquivo PDF');
  }
}

export function sanitizeAttachmentName(originalName: string): string {
  const name = basename(originalName)
    .replace(/[\\/\r\n\t\0]/g, '_')
    .trim()
    .slice(0, 200);
  return name || 'comprovante.pdf';
}
