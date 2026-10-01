import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TechnologyCategory } from '@prisma/client';
import { PaginationQuery } from '../../../shared/common/pagination';
import { ToBoolean } from '../../../shared/common/transforms';

export class QueryTechnologiesDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsEnum(TechnologyCategory)
  category?: TechnologyCategory;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;
}
