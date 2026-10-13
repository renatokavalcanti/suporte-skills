import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MeasurementStatus } from '@prisma/client';
import { PaginationQuery } from '../../../shared/common/pagination';

export class QueryMeasurementsDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  clientId?: string;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsEnum(MeasurementStatus)
  status?: MeasurementStatus;
}
