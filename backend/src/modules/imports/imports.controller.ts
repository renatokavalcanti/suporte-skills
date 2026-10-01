import {
  BadRequestException,
  Controller,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ImportType, ImportsService } from './imports.service';

interface UploadedCsvFile {
  buffer?: Buffer;
  originalname?: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024;

@Controller('imports')
@Roles(Role.ADMIN, Role.MANAGER)
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Post(':type/preview')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_request, file, callback) => {
        const isCsv =
          file.originalname.toLowerCase().endsWith('.csv') ||
          ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/csv'].includes(
            file.mimetype,
          );
        if (!isCsv) {
          callback(new BadRequestException('Envie um arquivo CSV'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  preview(
    @Param('type') type: string,
    @UploadedFile() file?: UploadedCsvFile,
  ) {
    return this.service.preview(this.parseType(type), this.readFile(file));
  }

  @Post(':type/commit')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_request, file, callback) => {
        const isCsv =
          file.originalname.toLowerCase().endsWith('.csv') ||
          ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/csv'].includes(
            file.mimetype,
          );
        if (!isCsv) {
          callback(new BadRequestException('Envie um arquivo CSV'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  commit(
    @Param('type') type: string,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.commit(
      this.parseType(type),
      this.readFile(file),
      user,
    );
  }

  private parseType(type: string): ImportType {
    if (type === 'professionals' || type === 'certifications') {
      return type;
    }
    throw new BadRequestException('Tipo de importacao invalido');
  }

  private readFile(file?: UploadedCsvFile): string {
    if (!file?.buffer) {
      throw new BadRequestException('Arquivo nao enviado');
    }
    return file.buffer.toString('utf-8');
  }
}
