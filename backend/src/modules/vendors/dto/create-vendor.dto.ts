import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PartnershipStatus } from '@prisma/client';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do fabricante' })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Website deve ser uma URL valida' })
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsEnum(PartnershipStatus)
  partnershipStatus?: PartnershipStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  partnershipLevel?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'partnershipStartDate deve ser uma data ISO' })
  partnershipStartDate?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'partnershipRenewalDate deve ser uma data ISO' })
  partnershipRenewalDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
