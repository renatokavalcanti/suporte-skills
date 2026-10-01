import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQuery } from '../../../shared/common/pagination';
import { ToBoolean } from '../../../shared/common/transforms';

export class QueryReleasesDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  current?: boolean;
}
