import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../../shared/common/authenticated-user.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { TicketsEnabledGuard } from '../../../shared/guards/tickets-enabled.guard';
import { TestZohoConnectionDto } from '../dto/test-zoho-settings.dto';
import { UpdateZohoSettingsDto } from '../dto/update-zoho-settings.dto';
import { ZohoSyncService } from '../zoho-sync.service';
import { ZohoClientService } from './zoho-client.service';
import { ZohoSettingsService } from './zoho-settings.service';

/**
 * Configuração da integração com o Zoho Desk (D-030), em
 * Configurações > Integração Zoho Desk. Somente ADMIN. As credenciais nunca
 * são devolvidas; o envio de segredos não é registrado.
 */
@Controller('settings/zoho')
@Roles(Role.ADMIN)
@UseGuards(TicketsEnabledGuard)
export class ZohoIntegrationController {
  constructor(
    private readonly settings: ZohoSettingsService,
    private readonly client: ZohoClientService,
    private readonly sync: ZohoSyncService,
  ) {}

  @Get()
  view() {
    return this.settings.getView();
  }

  @Put()
  update(
    @Body() dto: UpdateZohoSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.update(dto, user);
  }

  @Post('test')
  @HttpCode(200)
  test(@Body() dto: TestZohoConnectionDto) {
    return this.client.testConnection(dto);
  }

  @Post('sync')
  @HttpCode(200)
  runSync(@CurrentUser() user: AuthenticatedUser) {
    return this.sync.syncAll(user.id);
  }

  @Post('disconnect')
  @HttpCode(200)
  disconnect(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.disconnect(user);
  }

  @Get('sync-log')
  syncLog() {
    return this.sync.logging();
  }
}
