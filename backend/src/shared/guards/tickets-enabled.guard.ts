import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';

/**
 * Feature flag do modulo Tickets (D-029). Enquanto TICKETS_ENABLED=false, as
 * rotas do modulo respondem 404 (como se nao existissem), para nao expor a
 * funcionalidade antes da fase de release. A verificacao vem depois da
 * autenticacao (guards globais) e antes do controller.
 */
@Injectable()
export class TicketsEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    const enabled =
      this.config.get<AppConfiguration['tickets']>('tickets')?.enabled ?? false;
    if (!enabled) {
      throw new NotFoundException('Modulo Tickets desativado');
    }
    return true;
  }
}
