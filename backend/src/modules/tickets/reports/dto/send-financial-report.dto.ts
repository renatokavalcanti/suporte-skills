import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { GenerateTicketReportDto } from './generate-ticket-report.dto';

export class SendFinancialReportDto extends GenerateTicketReportDto {
  /** Destinatarios (separados por virgula). Ausente usa o e-mail do contrato. */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  recipients?: string;

  /** Exigido: o envio so' ocorre com confirmacao explicita. */
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
