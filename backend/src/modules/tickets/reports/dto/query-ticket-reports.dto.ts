import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQuery } from '../../../../shared/common/pagination';
import { DATE_ONLY } from './preview-ticket-report.dto';

export class QueryTicketReportsDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsIn(['FINANCIAL', 'CLIENT'])
  type?: 'FINANCIAL' | 'CLIENT';

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'from deve ser YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'to deve ser YYYY-MM-DD' })
  to?: string;
}
