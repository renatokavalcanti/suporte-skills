/**
 * Flags de funcionalidade do frontend. O modulo Tickets fica oculto por padrao;
 * ligue com VITE_TICKETS_ENABLED=true (mesma decisao do TICKETS_ENABLED no
 * backend, D-029).
 */
export const TICKETS_ENABLED = import.meta.env.VITE_TICKETS_ENABLED === 'true';
