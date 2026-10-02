import { Global, Module } from '@nestjs/common';
import { AttachmentStorageService } from './attachment-storage.service';

/**
 * Armazenamento em disco de anexos (D-025). Global por simplicidade: qualquer
 * modulo pode persistir/ler arquivos pelo mesmo diretorio configurado.
 */
@Global()
@Module({
  providers: [AttachmentStorageService],
  exports: [AttachmentStorageService],
})
export class StorageModule {}
