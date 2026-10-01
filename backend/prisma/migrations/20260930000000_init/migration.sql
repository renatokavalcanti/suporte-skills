-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "ProfessionalType" AS ENUM ('CLT', 'PJ', 'INTERN', 'PARTNER', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('JUNIOR', 'MID', 'SENIOR', 'SPECIALIST', 'LEAD');

-- CreateEnum
CREATE TYPE "PartnershipStatus" AS ENUM ('NONE', 'ACTIVE', 'PENDING', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TechnologyCategory" AS ENUM ('OPERATING_SYSTEM', 'VIRTUALIZATION', 'CONTAINER_PLATFORM', 'CLOUD', 'AUTOMATION', 'BACKUP', 'STORAGE', 'HARDWARE', 'NETWORK', 'MANAGEMENT', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "CertificationLevel" AS ENUM ('FOUNDATIONAL', 'ASSOCIATE', 'PROFESSIONAL', 'EXPERT', 'SPECIALIST', 'ARCHITECT');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'UPDATING', 'DISCONTINUED', 'REPLACED');

-- CreateEnum
CREATE TYPE "RoadmapType" AS ENUM ('CERTIFICATION', 'RENEWAL', 'COURSE', 'TRAINING', 'PROJECT', 'LAB');

-- CreateEnum
CREATE TYPE "RoadmapPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "RoadmapStatus" AS ENUM ('BACKLOG', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "professionals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "provider_id" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CONSULTANT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" TEXT,
    "professional_type" "ProfessionalType",
    "seniority" "Seniority",
    "hire_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "logo_url" TEXT,
    "partnership_status" "PartnershipStatus" NOT NULL DEFAULT 'NONE',
    "partnership_level" TEXT,
    "partnership_start_date" DATE,
    "partnership_renewal_date" DATE,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technologies" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TechnologyCategory",
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "technology_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "level" "CertificationLevel",
    "official_url" TEXT,
    "validity_months" INTEGER,
    "catalog_status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_certifications" (
    "id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "certification_id" TEXT NOT NULL,
    "certificate_number" TEXT,
    "obtained_at" DATE,
    "expires_at" DATE,
    "proof_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_items" (
    "id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "technology_id" TEXT,
    "certification_id" TEXT,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "description" TEXT,
    "type" "RoadmapType" NOT NULL,
    "priority" "RoadmapPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "RoadmapStatus" NOT NULL DEFAULT 'BACKLOG',
    "start_date" DATE,
    "due_date" DATE,
    "completed_at" TIMESTAMP(3),
    "owner_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "professionals_email_key" ON "professionals"("email");

-- CreateIndex
CREATE INDEX "professionals_active_idx" ON "professionals"("active");

-- CreateIndex
CREATE INDEX "professionals_role_idx" ON "professionals"("role");

-- CreateIndex
CREATE INDEX "refresh_tokens_professional_id_idx" ON "refresh_tokens"("professional_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_name_key" ON "vendors"("name");

-- CreateIndex
CREATE INDEX "vendors_active_idx" ON "vendors"("active");

-- CreateIndex
CREATE INDEX "technologies_active_idx" ON "technologies"("active");

-- CreateIndex
CREATE UNIQUE INDEX "technologies_vendor_id_name_key" ON "technologies"("vendor_id", "name");

-- CreateIndex
CREATE INDEX "certifications_vendor_id_idx" ON "certifications"("vendor_id");

-- CreateIndex
CREATE INDEX "certifications_technology_id_idx" ON "certifications"("technology_id");

-- CreateIndex
CREATE INDEX "certifications_active_idx" ON "certifications"("active");

-- CreateIndex
CREATE INDEX "professional_certifications_professional_id_idx" ON "professional_certifications"("professional_id");

-- CreateIndex
CREATE INDEX "professional_certifications_certification_id_idx" ON "professional_certifications"("certification_id");

-- CreateIndex
CREATE INDEX "professional_certifications_expires_at_idx" ON "professional_certifications"("expires_at");

-- CreateIndex
CREATE INDEX "roadmap_items_professional_id_idx" ON "roadmap_items"("professional_id");

-- CreateIndex
CREATE INDEX "roadmap_items_status_idx" ON "roadmap_items"("status");

-- CreateIndex
CREATE INDEX "roadmap_items_due_date_idx" ON "roadmap_items"("due_date");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technologies" ADD CONSTRAINT "technologies_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technologies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_certifications" ADD CONSTRAINT "professional_certifications_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_certifications" ADD CONSTRAINT "professional_certifications_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technologies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "professionals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

