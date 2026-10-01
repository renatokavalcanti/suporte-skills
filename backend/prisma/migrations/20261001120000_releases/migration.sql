-- CreateEnum
CREATE TYPE "ReleaseCategory" AS ENUM ('FEATURE', 'IMPROVEMENT', 'FIX', 'SECURITY', 'INFRA', 'OTHER');

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "released_at" TIMESTAMP(3) NOT NULL,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_items" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "category" "ReleaseCategory" NOT NULL DEFAULT 'FEATURE',
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "release_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "releases_version_key" ON "releases"("version");

-- CreateIndex
CREATE INDEX "releases_hidden_idx" ON "releases"("hidden");

-- CreateIndex
CREATE INDEX "releases_released_at_idx" ON "releases"("released_at");

-- CreateIndex
CREATE INDEX "release_items_release_id_idx" ON "release_items"("release_id");

-- AddForeignKey
ALTER TABLE "release_items" ADD CONSTRAINT "release_items_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
