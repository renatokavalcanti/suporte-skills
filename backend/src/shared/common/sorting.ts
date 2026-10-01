export type SortDirection = 'asc' | 'desc';

/**
 * Monta um orderBy seguro para o Prisma, permitindo apenas campos
 * previamente autorizados (evita injecao de ordenacao arbitraria).
 */
export function buildOrderBy(
  sort: string | undefined,
  allowed: readonly string[],
  fallback: string,
  order: SortDirection = 'asc',
): Record<string, SortDirection> {
  const field = sort && allowed.includes(sort) ? sort : fallback;
  return { [field]: order };
}
