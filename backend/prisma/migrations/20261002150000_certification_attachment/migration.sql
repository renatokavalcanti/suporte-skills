-- AlterTable
ALTER TABLE "professional_certifications"
  ADD COLUMN "attachment_file" TEXT,
  ADD COLUMN "attachment_name" TEXT,
  ADD COLUMN "attachment_mime" TEXT,
  ADD COLUMN "attachment_size" INTEGER,
  ADD COLUMN "attachment_uploaded_at" TIMESTAMP(3);
