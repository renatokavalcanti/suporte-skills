import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Periodo por mes/ano OU por intervalo (from/to). Validado no servico. */
export class PreviewTicketReportDto {
  @IsOptional()
  @IsString()
  clientId?: string;

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
