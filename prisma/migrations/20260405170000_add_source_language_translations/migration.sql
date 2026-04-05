-- AlterTable
ALTER TABLE "edit_candidates" ADD COLUMN "sourceLanguage" TEXT;
ALTER TABLE "edit_candidates" ADD COLUMN "translatedValues" JSONB;
