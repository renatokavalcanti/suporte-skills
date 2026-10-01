import { Role } from '@prisma/client';

/**
 * Usuario autenticado anexado a request apos o JwtAuthGuard.
 * Decisao D-003: id e o proprio professionalId (entidade unica).
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
