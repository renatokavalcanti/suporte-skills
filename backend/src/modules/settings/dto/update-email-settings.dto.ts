import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateEmailSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['SMTP', 'GRAPH'])
  transport?: 'SMTP' | 'GRAPH';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fromName?: string;

  @IsOptional()
  @ValidateIf((o: UpdateEmailSettingsDto) => o.fromAddress !== '')
  @IsEmail({}, { message: 'Informe um e-mail de remetente valido' })
  @MaxLength(200)
  fromAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  smtpHost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  smtpUser?: string;

  /** Nova senha SMTP (em branco/ausente mantem a atual). */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  smtpPassword?: string;

  @IsOptional()
  @IsBoolean()
  clearSmtpPassword?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  graphTenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  graphClientId?: string;

  /** Novo client secret do Graph (em branco/ausente mantem o atual). */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  graphClientSecret?: string;

  @IsOptional()
  @IsBoolean()
  clearGraphClientSecret?: boolean;
}
