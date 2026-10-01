import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RoadmapPriority, RoadmapStatus, RoadmapType } from '@prisma/client';
import { PaginationQuery } from '../../../shared/common/pagination';
import { ToBoolean } from '../../../shared/common/transforms';

export class QueryRoadmapDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  technologyId?: string;

  @IsOptional()
  @IsString()
  certificationId?: string;

  @IsOptional()
  @IsEnum(RoadmapType)
  type?: RoadmapType;

  @IsOptional()
  @IsEnum(RoadmapPriority)
  priority?: RoadmapPriority;

  @IsOptional()
  @IsEnum(RoadmapStatus)
  status?: RoadmapStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  overdue?: boolean;
}
