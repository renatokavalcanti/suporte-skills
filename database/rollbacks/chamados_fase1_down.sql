-- ===========================================================================
-- Rollback manual - Fase 1 do modulo Chamados (D-030)
--
-- NAO faz parte do fluxo de migrations do Prisma (nao existe "down" automatico).
-- Reverte a migration 20261013172326_add_contracts_time_entries_reports
-- (contratos, lancamentos de tempo e relatorios gerados).
-- Ordem: tabelas filhas -> tipos (enums) -> colunas de "tickets".
-- Alternativa: restaurar um dump.
--
--   docker compose exec -T db psql -U suporte -d suporte_skills < database/rollbacks/chamados_fase1_down.sql
-- ===========================================================================

-- Tabelas novas (os indices e FKs sao removidos junto com a tabela).
DROP TABLE IF EXISTS "generated_reports";
DROP TABLE IF EXISTS "time_entries";
DROP TABLE IF EXISTS "contracts";

-- Tipos (enums) criados pela migration.
DROP TYPE IF EXISTS "BillingStatus";
DROP TYPE IF EXISTS "GeneratedReportType";
DROP TYPE IF EXISTS "BalancePolicy";

-- Indice e colunas adicionadas em "tickets".
DROP INDEX IF EXISTS "tickets_technology_name_idx";

ALTER TABLE "tickets"
  DROP COLUMN IF EXISTS "technology_name",
  DROP COLUMN IF EXISTS "assignee_id",
  DROP COLUMN IF EXISTS "account_name",
  DROP COLUMN IF EXISTS "account_id",
  DROP COLUMN IF EXISTS "department_id",
  DROP COLUMN IF EXISTS "contact_id";
