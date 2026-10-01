import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restringe a rota aos papeis informados. Autorizacao aplicada no backend. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
