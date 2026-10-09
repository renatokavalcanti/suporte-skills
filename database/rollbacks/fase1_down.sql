-- ===========================================================================
-- Rollback manual - Fase 1 do modulo Tickets (D-029)
--
-- NAO faz parte do fluxo de migrations do Prisma (nao existe "down" automatico).
-- Use para reverter a migration 20261009201718_add_tickets_clients.
-- A ordem importa: "tickets" primeiro (possui FK para "clients"), depois
-- "clients". Alternativa preferivel: restaurar um dump de backups/
-- (gerado por scripts/backup-db.sh).
--
--   docker compose exec -T db psql -U suporte -d suporte_skills < database/rollbacks/fase1_down.sql
-- ===========================================================================

DROP TABLE IF EXISTS "tickets";
DROP TABLE IF EXISTS "clients";
