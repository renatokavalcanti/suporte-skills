import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQuery } from '../../../shared/common/pagination';
import { ToBoolean } from '../../../shared/common/transforms';

export class QueryTicketsDto extends PaginationQuery {
  /** Filtra por cliente (id local). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  clientId?: string;

  /** Status exatamente como veio do Zoho (texto livre, D-029). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  /** Busca por titulo ou numero do chamado. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  /** Periodo por close_date (data de referencia da medicao). ISO YYYY-MM-DD, inclusivo. */
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  /** Quando informado, filtra por is_billable. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  billable?: boolean;
}
