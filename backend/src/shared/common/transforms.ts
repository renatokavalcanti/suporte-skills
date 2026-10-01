import { Transform } from 'class-transformer';

/**
 * Converte "true"/"false" (query string) em boolean sem os problemas do
 * Boolean() implicito (que transforma "false" em true).
 */
export const ToBoolean = () =>
  Transform(({ value }) => {
    if (value === true || value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === 0 || value === '0') {
      return false;
    }
    return value;
  });
