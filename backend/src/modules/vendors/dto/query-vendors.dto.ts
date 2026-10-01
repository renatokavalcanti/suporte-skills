import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PartnershipStatus } from '@prisma/client';
import { PaginationQuery } from '../../../shared/common/pagination';
import { ToBoolean } from '../../../shared/common/transforms';

export class QueryVendorsDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(PartnershipStatus)
  partnershipStatus?: PartnershipStatus;
}
