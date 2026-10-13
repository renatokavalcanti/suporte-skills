-- CreateTable
CREATE TABLE "unmapped_tickets" (
    "id" TEXT NOT NULL,
    "zoho_ticket_id" TEXT NOT NULL,
    "account_id" TEXT,
    "account_name" TEXT,
    "subject" TEXT,
    "raw" JSONB NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unmapped_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unmapped_tickets_zoho_ticket_id_key" ON "unmapped_tickets"("zoho_ticket_id");

-- CreateIndex
CREATE INDEX "unmapped_tickets_account_id_idx" ON "unmapped_tickets"("account_id");
