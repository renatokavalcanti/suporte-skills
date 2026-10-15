import {
  BadRequestException,
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
import { MailMessage } from '../../shared/reporting/email';
import { TestAiSettingsDto } from './dto/test-ai-settings.dto';
import { TestEmailSettingsDto } from './dto/test-email-settings.dto';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { UpdateBrandingSettingsDto } from './dto/update-branding-settings.dto';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { BrandingSettingsService } from './branding-settings.service';
import { EmailSettingsService } from './email-settings.service';
import { MailerService } from './mailer.service';
import { SettingsService } from './settings.service';

/**
 * Configuracoes do sistema editaveis pela interface. Restrito a ADMIN (segredos
 * nunca sao devolvidos pela API).
 */
@Controller('settings')
@Roles(Role.ADMIN)
export class SettingsController {
  constructor(
    private readonly service: SettingsService,
    private readonly emailSettings: EmailSettingsService,
    private readonly mailer: MailerService,
    private readonly branding: BrandingSettingsService,
  ) {}

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

  @Get('email')
  getEmail() {
    return this.emailSettings.getView();
  }

  @Put('email')
  updateEmail(
    @Body() dto: UpdateEmailSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.emailSettings.update(dto, user);
  }

  @Post('email/test')
  @HttpCode(200)
  async testEmail(@Body() dto: TestEmailSettingsDto) {
    // Overrides transitorios: testa os valores informados sem salvar (D-036),
    // inclusive **antes** de habilitar o envio.
    const settings = this.emailSettings.resolveWithOverrides(dto);
    const to = dto.to?.trim() || settings.fromAddress;
    if (!to) {
      throw new BadRequestException('Informe o destinatario do e-mail de teste');
    }
    if (!settings.sendable) {
      throw new BadRequestException(
        settings.transport === 'GRAPH'
          ? 'Preencha tenant, client id, client secret e o remetente para testar'
          : 'Preencha o servidor SMTP e o remetente para testar',
      );
    }
    const message: MailMessage = {
      from: { name: settings.fromName, address: settings.fromAddress },
      to: [to],
      subject: 'Teste de envio — Suporte Skills',
      text: 'Este e um e-mail de teste da configuracao de envio.',
      html: '<p>Este e um e-mail de teste da configuracao de envio.</p>',
    };
    await this.mailer.send(message, settings);
    return { ok: true, message: `E-mail de teste enviado para ${to}` };
  }

  @Get('branding')
  getBranding() {
    return this.branding.getView();
  }

  @Put('branding')
  updateBranding(
    @Body() dto: UpdateBrandingSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.branding.update(dto, user);
  }
}
