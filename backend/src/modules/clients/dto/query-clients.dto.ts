import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQuery } from '../../../shared/common/pagination';
import { ToBoolean } from '../../../shared/common/transforms';

export class QueryClientsDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;
}
