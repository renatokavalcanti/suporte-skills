import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, type ReadStream } from 'node:fs';
import { access, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Subpastas usadas pelos anexos (cada recurso tem a sua). */
export const ATTACHMENT_FOLDERS = {
  certificates: 'certificates',
  roadmap: 'roadmap',
} as const;

export type AttachmentFolder =
  (typeof ATTACHMENT_FOLDERS)[keyof typeof ATTACHMENT_FOLDERS];

const DEFAULT_FOLDER: AttachmentFolder = ATTACHMENT_FOLDERS.certificates;

/**
 * Armazenamento de anexos em disco (D-025/D-026).
 *
 * Os arquivos ficam FORA do web root, em UPLOADS_DIR (bind mount persistente),
 * sob uma subpasta por recurso (`certificates/`, `roadmap/`). O nome no disco
 * e' aleatorio (UUID) e o nome original fica apenas no banco; toda leitura
 * passa por rota autenticada.
 */
@Injectable()
export class AttachmentStorageService implements OnModuleInit {
  private readonly logger = new Logger(AttachmentStorageService.name);
  private readonly baseDir: string;
  private readonly maxBytes: number;

  constructor(config: ConfigService) {
    this.baseDir = resolve(config.get<string>('uploads.dir') ?? 'uploads');
    this.maxBytes = config.get<number>('uploads.maxFileBytes') ?? 10 * 1024 * 1024;
  }

  get maxFileBytes(): number {
    return this.maxBytes;
  }

  async onModuleInit(): Promise<void> {
    for (const folder of Object.values(ATTACHMENT_FOLDERS)) {
      await mkdir(this.directory(folder), { recursive: true });
    }
    this.logger.log(`Anexos em ${this.baseDir}`);
  }

  private directory(folder: AttachmentFolder = DEFAULT_FOLDER): string {
    return join(this.baseDir, folder);
  }

  /** Resolve o caminho absoluto garantindo que nao escapa do diretorio. */
  pathOf(storedName: string, folder: AttachmentFolder = DEFAULT_FOLDER): string {
    const root = resolve(this.directory(folder));
    const full = resolve(root, storedName);
    if (full !== root && !full.startsWith(root + sep)) {
      throw new Error('Nome de arquivo invalido');
    }
    return full;
  }

  async save(
    buffer: Buffer,
    extension = '.pdf',
    folder: AttachmentFolder = DEFAULT_FOLDER,
  ): Promise<string> {
    // A pasta pode ter sido removida com a aplicacao no ar (ex.: limpeza de
    // dados); garante que existe antes de gravar.
    await mkdir(this.directory(folder), { recursive: true });
    const storedName = `${randomUUID()}${extension}`;
    await writeFile(this.pathOf(storedName, folder), buffer, { flag: 'wx' });
    return storedName;
  }

  async exists(
    storedName: string,
    folder: AttachmentFolder = DEFAULT_FOLDER,
  ): Promise<boolean> {
    try {
      await access(this.pathOf(storedName, folder));
      return true;
    } catch {
      return false;
    }
  }

  stream(
    storedName: string,
    folder: AttachmentFolder = DEFAULT_FOLDER,
  ): ReadStream {
    return createReadStream(this.pathOf(storedName, folder));
  }

  async remove(
    storedName: string,
    folder: AttachmentFolder = DEFAULT_FOLDER,
  ): Promise<void> {
    try {
      await unlink(this.pathOf(storedName, folder));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
    }
  }

  /** Apaga os anexos (usado pelo go-live ao limpar os dados). */
  async clear(folder?: AttachmentFolder): Promise<void> {
    if (folder) {
      await rm(this.directory(folder), { recursive: true, force: true });
      await mkdir(this.directory(folder), { recursive: true });
      return;
    }
    for (const current of Object.values(ATTACHMENT_FOLDERS)) {
      await rm(this.directory(current), { recursive: true, force: true });
      await mkdir(this.directory(current), { recursive: true });
    }
  }
}
