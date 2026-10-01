import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ProfessionalType, Role, Seniority } from '@prisma/client';

export class CreateProfessionalDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(120)
  name!: string;

  @IsEmail({}, { message: 'Informe um e-mail valido' })
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string;

  @IsOptional()
  @IsEnum(ProfessionalType)
  professionalType?: ProfessionalType;

  @IsOptional()
  @IsEnum(Seniority)
  seniority?: Seniority;

  @IsOptional()
  @IsDateString({ strict: true }, { message: 'hireDate deve ser uma data ISO (YYYY-MM-DD)' })
  hireDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // Somente ADMIN pode definir papel/senha (validado no service).
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A senha deve ter ao menos 6 caracteres' })
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
