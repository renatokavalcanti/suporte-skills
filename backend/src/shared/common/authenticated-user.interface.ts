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
  // Senha provisoria: enquanto true, apenas a troca de senha e permitida (D-024).
  mustChangePassword: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean;
}
