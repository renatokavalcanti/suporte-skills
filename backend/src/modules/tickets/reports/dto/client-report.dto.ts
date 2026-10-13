import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PreviewTicketReportDto } from './preview-ticket-report.dto';

export class ClientReportDto extends PreviewTicketReportDto {
  /** "Principais atuações no período" (editável pelo analista). */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  highlights?: string;

  /** "Pendências e recomendações" (editável pelo analista). */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recommendations?: string;
}
