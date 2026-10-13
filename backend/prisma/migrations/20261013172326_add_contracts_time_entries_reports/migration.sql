-- CreateEnum
CREATE TYPE "BalancePolicy" AS ENUM ('EXPIRE', 'ACCUMULATE');

-- CreateEnum
CREATE TYPE "GeneratedReportType" AS ENUM ('FINANCIAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('STANDARD', 'WITH_EXTRA_HOURS');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "account_id" TEXT,
ADD COLUMN     "account_name" TEXT,
ADD COLUMN     "assignee_id" TEXT,
ADD COLUMN     "contact_id" TEXT,
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "technology_name" TEXT;

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "included_minutes" INTEGER NOT NULL DEFAULT 0,
    "monthly_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "extra_hour_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_policy" "BalancePolicy" NOT NULL DEFAULT 'EXPIRE',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "finance_email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "zoho_time_entry_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "owner_name" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" "GeneratedReportType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "billing_status" "BillingStatus",
    "file_path" TEXT,
    "file_name" TEXT,
    "generated_by_id" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "sent_to" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_client_id_idx" ON "contracts"("client_id");

-- CreateIndex
CREATE INDEX "contracts_active_idx" ON "contracts"("active");

-- CreateIndex
CREATE UNIQUE INDEX "time_entries_zoho_time_entry_id_key" ON "time_entries"("zoho_time_entry_id");

-- CreateIndex
CREATE INDEX "time_entries_ticket_id_idx" ON "time_entries"("ticket_id");

-- CreateIndex
CREATE INDEX "time_entries_executed_at_idx" ON "time_entries"("executed_at");

-- CreateIndex
CREATE INDEX "generated_reports_client_id_type_idx" ON "generated_reports"("client_id", "type");

-- CreateIndex
CREATE INDEX "generated_reports_generated_at_idx" ON "generated_reports"("generated_at");

-- CreateIndex
CREATE INDEX "tickets_technology_name_idx" ON "tickets"("technology_name");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
