import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateProfessionalCertificationDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecione a certificacao' })
  certificationId!: string;

  /**
   * Renovacao: permite criar uma nova linha mesmo existindo um registro em
   * vigor, encerrando o anterior na vespera da data de obtencao informada.
   */
  @IsOptional()
  @IsBoolean()
  renew?: boolean;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'obtainedAt deve ser uma data ISO (YYYY-MM-DD)' })
  obtainedAt?: string;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'expiresAt deve ser uma data ISO (YYYY-MM-DD)' })
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  certificateNumber?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'URL de comprovacao invalida' })
  @MaxLength(500)
  proofUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
