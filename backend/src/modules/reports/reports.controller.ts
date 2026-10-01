import { Controller, Get, Query, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../../shared/decorators/roles.decorator';
import { toCsv } from '../../shared/reporting/csv';
import { QueryReportDto } from './dto/query-report.dto';
import { ReportKey, ReportsService } from './reports.service';

@Controller('reports')
@Roles(Role.ADMIN, Role.MANAGER)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('certifications')
  certifications(
    @Query() query: QueryReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond('certifications', query, res);
  }

  @Get('expirations')
  expirations(
    @Query() query: QueryReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond('expirations', query, res);
  }

  @Get('roadmap')
  roadmap(
    @Query() query: QueryReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond('roadmap', query, res);
  }

  @Get('vendors')
  vendors(
    @Query() query: QueryReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond('vendors', query, res);
  }

  private async respond(
    key: ReportKey,
    query: QueryReportDto,
    res: Response,
  ) {
    const report = await this.service.generate(key, query);

    if (query.format === 'csv') {
      const today = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="suporte-skills-${key}-${today}.csv"`,
      );
      return toCsv(report);
    }

    return report;
  }
}
