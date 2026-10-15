import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { PaginationQuery } from '../../shared/common/pagination';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { TicketsEnabledGuard } from '../../shared/guards/tickets-enabled.guard';
import { BulkLinkUnmappedDto } from './dto/bulk-link-unmapped.dto';
import { LinkUnmappedDto } from './dto/link-unmapped.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { TicketsService } from './tickets.service';
import { ZohoSyncService } from './zoho-sync.service';

/**
 * Chamados espelhados do Zoho Desk (D-029). Leitura para ADMIN/MANAGER; as
 * acoes de sincronizacao e mapeamento sao restritas a ADMIN.
 */
@Controller('tickets')
@Roles(Role.ADMIN, Role.MANAGER)
@UseGuards(TicketsEnabledGuard)
export class TicketsController {
  constructor(
    private readonly service: TicketsService,
    private readonly sync: ZohoSyncService,
  ) {}

  @Get()
  list(@Query() query: QueryTicketsDto) {
    return this.service.list(query);
  }

  @Get('sync/status')
  @Roles(Role.ADMIN)
  syncStatus() {
    return this.sync.status();
  }

  @Get('unmapped')
  @Roles(Role.ADMIN)
  unmapped(@Query() query: PaginationQuery) {
    return this.sync.listUnmapped(query);
  }

  @Get('unmapped/groups')
  @Roles(Role.ADMIN)
  unmappedGroups() {
    return this.sync.listUnmappedGroups();
  }

  @Post('sync')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  runSync(@CurrentUser() user: AuthenticatedUser) {
    return this.sync.syncAll(user.id);
  }

  @Post('sync/time-entries')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  refreshTimeEntries(@CurrentUser() user: AuthenticatedUser) {
    return this.sync.refreshTimeEntries(user);
  }

  @Post('unmapped/:id/link')
  @Roles(Role.ADMIN)
  linkUnmapped(
    @Param('id') id: string,
    @Body() dto: LinkUnmappedDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sync.linkUnmapped(id, dto.clientId, user);
  }

  @Post('unmapped/link')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  linkUnmappedBulk(
    @Body() dto: BulkLinkUnmappedDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sync.linkUnmappedBulk(dto, user);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  /** Re-associacao: troca o cliente de um chamado ja mapeado (D-035). */
  @Patch(':id/client')
  @Roles(Role.ADMIN)
  reassignClient(
    @Param('id') id: string,
    @Body() dto: LinkUnmappedDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sync.reassignTicket(id, dto.clientId, user);
  }

  /** Desassociacao: devolve o chamado a fila de nao mapeados (D-035). */
  @Post(':id/unlink')
  @Roles(Role.ADMIN)
  unlink(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sync.unlinkTicket(id, user);
  }

  /** Reimporta os lancamentos de tempo de um unico chamado (D-035). */
  @Post(':id/refresh-time-entries')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  refreshTicketTimeEntries(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sync.refreshTicketTimeEntries(id, user);
  }
}
