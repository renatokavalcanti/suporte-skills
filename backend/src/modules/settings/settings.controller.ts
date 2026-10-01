import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { TestAiSettingsDto } from './dto/test-ai-settings.dto';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { SettingsService } from './settings.service';

/**
 * Configuracoes do sistema editaveis pela interface. Restrito a ADMIN (a
 * chave da API e' um segredo; nunca e' devolvida pela API).
 */
@Controller('settings')
@Roles(Role.ADMIN)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('ai')
  getAi() {
    return this.service.getView();
  }

  @Put('ai')
  updateAi(
    @Body() dto: UpdateAiSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(dto, user);
  }

  @Post('ai/test')
  @HttpCode(200)
  testAi(@Body() dto: TestAiSettingsDto) {
    return this.service.test(dto);
  }
}
