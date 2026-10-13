-- CreateEnum
CREATE TYPE "MeasurementStatus" AS ENUM ('DRAFT', 'CLOSED');

-- CreateTable
CREATE TABLE "monthly_measurements" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "MeasurementStatus" NOT NULL DEFAULT 'DRAFT',
    "ticket_count" INTEGER NOT NULL DEFAULT 0,
    "time_spent_minutes" INTEGER NOT NULL DEFAULT 0,
    "sla_evaluated_count" INTEGER NOT NULL DEFAULT 0,
    "sla_compliant_count" INTEGER NOT NULL DEFAULT 0,
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_measurement_items" (
    "id" TEXT NOT NULL,
    "measurement_id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "zoho_ticket_id" TEXT NOT NULL,
    "ticket_number" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "close_date" TIMESTAMP(3),
    "time_spent_minutes" INTEGER NOT NULL DEFAULT 0,
    "sla_compliant" BOOLEAN,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_measurement_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_measurements_year_month_idx" ON "monthly_measurements"("year", "month");

-- CreateIndex
CREATE INDEX "monthly_measurements_status_idx" ON "monthly_measurements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_measurements_client_id_year_month_key" ON "monthly_measurements"("client_id", "year", "month");

-- CreateIndex
CREATE INDEX "monthly_measurement_items_measurement_id_idx" ON "monthly_measurement_items"("measurement_id");

-- AddForeignKey
ALTER TABLE "monthly_measurements" ADD CONSTRAINT "monthly_measurements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_measurements" ADD CONSTRAINT "monthly_measurements_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_measurement_items" ADD CONSTRAINT "monthly_measurement_items_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "monthly_measurements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_measurement_items" ADD CONSTRAINT "monthly_measurement_items_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
