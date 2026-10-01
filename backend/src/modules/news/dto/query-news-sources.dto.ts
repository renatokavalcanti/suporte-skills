import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQuery } from '../../../shared/common/pagination';
import { ToBoolean } from '../../../shared/common/transforms';

export class QueryNewsSourcesDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;
}
