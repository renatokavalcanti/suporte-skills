import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProfessionalType, Role, Seniority } from '@prisma/client';
import { PaginationQuery } from '../../../shared/common/pagination';
import { ToBoolean } from '../../../shared/common/transforms';

export class QueryProfessionalsDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(ProfessionalType)
  professionalType?: ProfessionalType;

  @IsOptional()
  @IsEnum(Seniority)
  seniority?: Seniority;
}
