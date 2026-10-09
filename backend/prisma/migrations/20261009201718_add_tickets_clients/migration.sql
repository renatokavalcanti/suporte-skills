-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "zoho_account_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "zoho_ticket_id" TEXT NOT NULL,
    "ticket_number" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "status_type" TEXT,
    "priority" TEXT,
    "category" TEXT,
    "assignee_name" TEXT,
    "open_date" TIMESTAMP(3) NOT NULL,
    "close_date" TIMESTAMP(3),
    "time_spent_minutes" INTEGER NOT NULL DEFAULT 0,
    "sla_compliant" BOOLEAN,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "zoho_modified_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "client_id" TEXT NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_document_key" ON "clients"("document");

-- CreateIndex
CREATE UNIQUE INDEX "clients_zoho_account_id_key" ON "clients"("zoho_account_id");

-- CreateIndex
CREATE INDEX "clients_active_idx" ON "clients"("active");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_zoho_ticket_id_key" ON "tickets"("zoho_ticket_id");

-- CreateIndex
CREATE INDEX "tickets_client_id_close_date_idx" ON "tickets"("client_id", "close_date");

-- CreateIndex
CREATE INDEX "tickets_client_id_open_date_idx" ON "tickets"("client_id", "open_date");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
