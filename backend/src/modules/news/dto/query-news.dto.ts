import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NewsKind } from '@prisma/client';
import { PaginationQuery } from '../../../shared/common/pagination';
import { ToBoolean } from '../../../shared/common/transforms';

export class QueryNewsDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  technologyId?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsEnum(NewsKind)
  kind?: NewsKind;

  /** Somente itens ainda nao lidos pelo usuario atual. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  unread?: boolean;

  /** Somente itens salvos pelo usuario atual. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  saved?: boolean;

  /** Somente itens fixados (destaques da gestao). */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
