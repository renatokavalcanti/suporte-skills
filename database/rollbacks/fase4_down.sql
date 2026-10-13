-- ===========================================================================
-- Rollback manual - Fase 4 do modulo Tickets (D-029)
--
-- NAO faz parte do fluxo de migrations do Prisma (nao existe "down" automatico).
-- Reverte a migration 20261013163918_monthly_measurements (Medicoes Mensais).
-- Ordem: itens (FK) -> medicoes -> enum. Alternativa: restaurar um dump.
--
--   docker compose exec -T db psql -U suporte -d suporte_skills < database/rollbacks/fase4_down.sql
-- ===========================================================================

DROP TABLE IF EXISTS "monthly_measurement_items";
DROP TABLE IF EXISTS "monthly_measurements";
DROP TYPE IF EXISTS "MeasurementStatus";
