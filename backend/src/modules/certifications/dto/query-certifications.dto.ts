import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CatalogStatus, CertificationLevel } from '@prisma/client';
import { PaginationQuery } from '../../../shared/common/pagination';
import { ToBoolean } from '../../../shared/common/transforms';

export class QueryCertificationsDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  technologyId?: string;

  @IsOptional()
  @IsEnum(CertificationLevel)
  level?: CertificationLevel;

  @IsOptional()
  @IsEnum(CatalogStatus)
  catalogStatus?: CatalogStatus;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;
}
