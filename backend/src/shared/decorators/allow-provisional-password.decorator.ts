import { SetMetadata } from '@nestjs/common';

export const ALLOW_PROVISIONAL_PASSWORD_KEY = 'allowProvisionalPassword';

/**
 * Marca uma rota que continua acessivel mesmo quando a senha e provisoria
 * (D-024): troca de senha, logout e consulta do proprio usuario.
 */
export const AllowProvisionalPassword = () =>
  SetMetadata(ALLOW_PROVISIONAL_PASSWORD_KEY, true);
