import { IsIn, IsOptional, IsString } from 'class-validator';

export class QueryReportDto {
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';

  @IsOptional()
  @IsString()
  professionalId?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  technologyId?: string;
}
