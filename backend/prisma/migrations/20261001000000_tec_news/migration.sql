-- CreateEnum
CREATE TYPE "NewsConnectorType" AS ENUM ('RSS', 'ATOM', 'MANUAL');

-- CreateEnum
CREATE TYPE "NewsKind" AS ENUM ('RELEASE', 'CERTIFICATION', 'FEATURE', 'SECURITY', 'EVENT', 'GENERAL');

-- CreateTable
CREATE TABLE "news_sources" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "technology_id" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "connector_type" "NewsConnectorType" NOT NULL DEFAULT 'RSS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fetch_interval_minutes" INTEGER,
    "last_fetched_at" TIMESTAMP(3),
    "last_status" TEXT,
    "last_error" TEXT,
    "last_item_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" TEXT NOT NULL,
    "source_id" TEXT,
    "vendor_id" TEXT,
    "technology_id" TEXT,
    "external_id" TEXT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "author" TEXT,
    "kind" "NewsKind" NOT NULL DEFAULT 'GENERAL',
    "origin" TEXT NOT NULL DEFAULT 'feed',
    "published_at" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_read_states" (
    "id" TEXT NOT NULL,
    "news_item_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "saved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_read_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_sources_vendor_id_idx" ON "news_sources"("vendor_id");

-- CreateIndex
CREATE INDEX "news_sources_technology_id_idx" ON "news_sources"("technology_id");

-- CreateIndex
CREATE INDEX "news_sources_active_idx" ON "news_sources"("active");

-- CreateIndex
CREATE UNIQUE INDEX "news_items_url_key" ON "news_items"("url");

-- CreateIndex
CREATE INDEX "news_items_vendor_id_idx" ON "news_items"("vendor_id");

-- CreateIndex
CREATE INDEX "news_items_technology_id_idx" ON "news_items"("technology_id");

-- CreateIndex
CREATE INDEX "news_items_kind_idx" ON "news_items"("kind");

-- CreateIndex
CREATE INDEX "news_items_published_at_idx" ON "news_items"("published_at");

-- CreateIndex
CREATE INDEX "news_items_pinned_idx" ON "news_items"("pinned");

-- CreateIndex
CREATE INDEX "news_items_hidden_idx" ON "news_items"("hidden");

-- CreateIndex
CREATE UNIQUE INDEX "news_read_states_news_item_id_professional_id_key" ON "news_read_states"("news_item_id", "professional_id");

-- CreateIndex
CREATE INDEX "news_read_states_professional_id_idx" ON "news_read_states"("professional_id");

-- AddForeignKey
ALTER TABLE "news_sources" ADD CONSTRAINT "news_sources_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_sources" ADD CONSTRAINT "news_sources_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technologies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "news_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technologies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_read_states" ADD CONSTRAINT "news_read_states_news_item_id_fkey" FOREIGN KEY ("news_item_id") REFERENCES "news_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_read_states" ADD CONSTRAINT "news_read_states_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
