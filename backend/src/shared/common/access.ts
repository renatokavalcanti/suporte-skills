import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from './authenticated-user.interface';

/**
 * CONSULTANT so pode acessar os proprios dados.
 * ADMIN e MANAGER acessam qualquer profissional.
 */
export function assertProfessionalAccess(
  professionalId: string,
  actor: AuthenticatedUser,
): void {
  if (actor.role === Role.CONSULTANT && actor.id !== professionalId) {
    throw new ForbiddenException('Voce so pode acessar os seus proprios dados');
  }
}
