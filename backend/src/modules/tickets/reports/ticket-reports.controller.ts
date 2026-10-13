import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { AuthenticatedUser } from '../../../shared/common/authenticated-user.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { TicketsEnabledGuard } from '../../../shared/guards/tickets-enabled.guard';
import { GenerateTicketReportDto } from './dto/generate-ticket-report.dto';
import { ClientReportDto } from './dto/client-report.dto';
import { PreviewTicketReportDto } from './dto/preview-ticket-report.dto';
import { QueryTicketReportsDto } from './dto/query-ticket-reports.dto';
import { SendFinancialReportDto } from './dto/send-financial-report.dto';
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

  @Get('financial/preview')
  financialPreview(@Query() query: PreviewTicketReportDto) {
    return this.service.financialPreview(query);
  }

  @Get('financial/attachment.pdf')
  async financialPdf(
    @Query() query: PreviewTicketReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { fileName, buffer } = await this.service.financialPdf(query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return new StreamableFile(buffer);
  }

  @Get('financial/eml')
  async financialEml(
    @Query() query: PreviewTicketReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { fileName, buffer } = await this.service.financialEml(query);
    res.setHeader('Content-Type', 'message/rfc822');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return new StreamableFile(buffer);
  }

  @Post('financial/send')
  @HttpCode(200)
  sendFinancial(
    @Body() dto: SendFinancialReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.sendFinancial(dto, user);
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

  @Get('client/preview')
  clientPreview(@Query() query: ClientReportDto) {
    return this.service.clientPreview(query);
  }

  @Get('client/pdf')
  async clientPdf(
    @Query() query: ClientReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { fileName, buffer } = await this.service.clientPdf(query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return new StreamableFile(buffer);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
