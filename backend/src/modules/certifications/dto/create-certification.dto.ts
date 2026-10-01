import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CatalogStatus, CertificationLevel } from '@prisma/client';

export class CreateCertificationDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o fabricante' })
  vendorId!: string;

  @IsOptional()
  @IsString()
  technologyId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da certificacao' })
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  code?: string;

  @IsOptional()
  @IsEnum(CertificationLevel)
  level?: CertificationLevel;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'URL oficial invalida' })
  @MaxLength(500)
  officialUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  validityMonths?: number;

  @IsOptional()
  @IsEnum(CatalogStatus)
  catalogStatus?: CatalogStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
