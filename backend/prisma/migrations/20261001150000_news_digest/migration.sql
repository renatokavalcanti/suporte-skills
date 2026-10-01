-- CreateEnum
CREATE TYPE "NewsFocus" AS ENUM ('FEATURE', 'CERTIFICATION', 'SECURITY', 'RELEASE', 'OTHER');

-- AlterTable
ALTER TABLE "news_items"
    ADD COLUMN "relevance_score" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "relevance_focus" "NewsFocus",
    ADD COLUMN "relevance_note" TEXT,
    ADD COLUMN "scored_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "news_digests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "highlights" JSONB NOT NULL,
    "item_count" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "model" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "generated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_digests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_items_relevance_score_idx" ON "news_items"("relevance_score");

-- CreateIndex
CREATE INDEX "news_digests_created_at_idx" ON "news_digests"("created_at");
