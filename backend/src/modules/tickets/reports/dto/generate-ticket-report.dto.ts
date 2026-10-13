import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { DATE_ONLY } from './preview-ticket-report.dto';

export class GenerateTicketReportDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o cliente' })
  clientId!: string;

  @IsIn(['FINANCIAL', 'CLIENT'])
  type!: 'FINANCIAL' | 'CLIENT';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'from deve ser YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'to deve ser YYYY-MM-DD' })
  to?: string;
}
