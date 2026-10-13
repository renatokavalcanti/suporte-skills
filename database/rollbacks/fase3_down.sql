-- ===========================================================================
-- Rollback manual - Fase 3 do modulo Tickets (D-029)
--
-- NAO faz parte do fluxo de migrations do Prisma (nao existe "down" automatico).
-- Reverte a migration 20261013163255_unmapped_tickets (fila de nao-mapeados).
-- Alternativa preferivel: restaurar um dump de backups/.
--
-- Observacao: os chamados espelhados (tabela "tickets") podem ser removidos
-- seletivamente por data, se necessario; NUNCA apagar "clients".
--
--   docker compose exec -T db psql -U suporte -d suporte_skills < database/rollbacks/fase3_down.sql
-- ===========================================================================

DROP TABLE IF EXISTS "unmapped_tickets";
