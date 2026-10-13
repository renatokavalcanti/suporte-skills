import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../shared/decorators/roles.decorator';
import { TicketsEnabledGuard } from '../../shared/guards/tickets-enabled.guard';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { TicketsService } from './tickets.service';

/**
 * Chamados espelhados do Zoho Desk (D-029). Somente leitura nesta fase;
 * espelhamento entra na Fase 3. Restrito a ADMIN/MANAGER.
 */
@Controller('tickets')
@Roles(Role.ADMIN, Role.MANAGER)
@UseGuards(TicketsEnabledGuard)
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  @Get()
  list(@Query() query: QueryTicketsDto) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
