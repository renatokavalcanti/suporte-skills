import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from '../common/authenticated-user.interface';
import { ALLOW_PROVISIONAL_PASSWORD_KEY } from '../decorators/allow-provisional-password.decorator';

/**
 * Enquanto o usuario estiver com senha provisoria (mustChangePassword = true,
 * D-024), bloqueia qualquer rota de negocio. Somente as rotas marcadas com
 * @AllowProvisionalPassword() continuam acessiveis (trocar a senha, logout e
 * ler o proprio usuario). Rotas publicas seguem livres (sem request.user).
 */
@Injectable()
export class PasswordChangeRequiredGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PROVISIONAL_PASSWORD_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (user?.mustChangePassword) {
      throw new ForbiddenException(
        'Troca de senha obrigatoria no primeiro acesso',
      );
    }

    return true;
  }
}
