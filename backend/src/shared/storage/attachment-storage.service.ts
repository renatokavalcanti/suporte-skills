import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, type ReadStream } from 'node:fs';
import { access, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Armazenamento de anexos em disco (D-025).
 *
 * Os arquivos ficam FORA do web root, em UPLOADS_DIR (bind mount persistente),
 * sob `certificates/`. O nome no disco e' aleatorio (UUID) e o nome original
 * fica apenas no banco; toda leitura passa por rota autenticada.
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
    await mkdir(this.directory(), { recursive: true });
    this.logger.log(`Anexos em ${this.directory()}`);
  }

  private directory(): string {
    return join(this.baseDir, 'certificates');
  }

  /** Resolve o caminho absoluto garantindo que nao escapa do diretorio. */
  pathOf(storedName: string): string {
    const root = resolve(this.directory());
    const full = resolve(root, storedName);
    if (full !== root && !full.startsWith(root + sep)) {
      throw new Error('Nome de arquivo invalido');
    }
    return full;
  }

  async save(buffer: Buffer, extension = '.pdf'): Promise<string> {
    const storedName = `${randomUUID()}${extension}`;
    await writeFile(this.pathOf(storedName), buffer, { flag: 'wx' });
    return storedName;
  }

  async exists(storedName: string): Promise<boolean> {
    try {
      await access(this.pathOf(storedName));
      return true;
    } catch {
      return false;
    }
  }

  stream(storedName: string): ReadStream {
    return createReadStream(this.pathOf(storedName));
  }

  async remove(storedName: string): Promise<void> {
    try {
      await unlink(this.pathOf(storedName));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
    }
  }

  /** Apaga todos os anexos (usado pelo go-live ao limpar os dados). */
  async clear(): Promise<void> {
    await rm(this.directory(), { recursive: true, force: true });
    await mkdir(this.directory(), { recursive: true });
  }
}
