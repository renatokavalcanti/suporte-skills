import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../../shared/decorators/public.decorator';
import { TicketsEnabledGuard } from '../../../shared/guards/tickets-enabled.guard';
import { ZohoOAuthService } from './zoho-oauth.service';

/**
 * Callback do OAuth do Zoho (D-030). E' **publico** porque o navegador chega
 * aqui redirecionado pelo Zoho (sem token da API); a seguranca vem do `state`
 * de uso unico emitido por `GET /settings/zoho/auth-url` (ADMIN). Ao final o
 * navegador e' devolvido para a tela de Configuracoes com o resultado.
 */
@Controller('settings/zoho')
@UseGuards(TicketsEnabledGuard)
export class ZohoOAuthController {
  constructor(private readonly oauth: ZohoOAuthService) {}

  @Get('callback')
  @Public()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (error) {
      res.redirect(
        this.oauth.webRedirect({ zoho: 'error', reason: error }),
      );
      return;
    }
    if (!code || !state) {
      res.redirect(
        this.oauth.webRedirect({ zoho: 'error', reason: 'missing_code' }),
      );
      return;
    }

    try {
      const { warn } = await this.oauth.handleCallback(code, state);
      res.redirect(
        warn
          ? this.oauth.webRedirect({ zoho: 'connected', warn })
          : this.oauth.webRedirect({ zoho: 'connected' }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.redirect(
        this.oauth.webRedirect({ zoho: 'error', reason: message }),
      );
    }
  }
}
