import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../../shared/common/authenticated-user.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { TicketsEnabledGuard } from '../../../shared/guards/tickets-enabled.guard';
import { GenerateTicketReportDto } from './dto/generate-ticket-report.dto';
import { PreviewTicketReportDto } from './dto/preview-ticket-report.dto';
import { QueryTicketReportsDto } from './dto/query-ticket-reports.dto';
import { TicketReportsService } from './ticket-reports.service';

/**
 * Relatorios de Chamados (D-030). Metricas (B2) + previa, geracao auditada
 * (`generated_reports`) e lista. Modulo Tickets: ADMIN/MANAGER.
 */
@Controller('ticket-reports')
@Roles(Role.ADMIN, Role.MANAGER)
@UseGuards(TicketsEnabledGuard)
export class TicketReportsController {
  constructor(private readonly service: TicketReportsService) {}

  @Get('preview')
  preview(@Query() query: PreviewTicketReportDto) {
    return this.service.preview(query);
  }

  @Post()
  generate(
    @Body() dto: GenerateTicketReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.generate(dto, user);
  }

  @Get()
  list(@Query() query: QueryTicketReportsDto) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
