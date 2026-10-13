import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { TicketsEnabledGuard } from '../../shared/guards/tickets-enabled.guard';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { QueryMeasurementsDto } from './dto/query-measurements.dto';
import { ReopenMeasurementDto } from './dto/reopen-measurement.dto';
import { MeasurementsService } from './measurements.service';

/**
 * Medicoes Mensais (D-029). Restrito a ADMIN/MANAGER (TicketsEnabledGuard).
 * Reabertura de medicao fechada e' exclusiva de ADMIN.
 */
@Controller('measurements')
@Roles(Role.ADMIN, Role.MANAGER)
@UseGuards(TicketsEnabledGuard)
export class MeasurementsController {
  constructor(private readonly service: MeasurementsService) {}

  @Get()
  list(@Query() query: QueryMeasurementsDto) {
    return this.service.list(query);
  }

  @Post()
  generate(
    @Body() dto: CreateMeasurementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.generateDraft(dto, user);
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.close(id, user);
  }

  @Post(':id/reopen')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  reopen(
    @Param('id') id: string,
    @Body() dto: ReopenMeasurementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reopen(id, dto.justification, user);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
