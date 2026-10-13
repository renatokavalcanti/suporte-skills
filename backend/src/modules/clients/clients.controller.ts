import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { SetActiveDto } from '../../shared/common/active-status.dto';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { TicketsEnabledGuard } from '../../shared/guards/tickets-enabled.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

/** Clientes usados na Medicao Mensal (D-029). Modulo Tickets: ADMIN/MANAGER. */
@Controller('clients')
@Roles(Role.ADMIN, Role.MANAGER)
@UseGuards(TicketsEnabledGuard)
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Get()
  list(@Query() query: QueryClientsDto) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  setActive(
    @Param('id') id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setActive(id, dto.active, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.deactivate(id, user);
  }
}
