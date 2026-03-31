-- AlterEnum
ALTER TYPE "ProviderName" ADD VALUE 'TRANSCRIBE_SERVICES';

-- AlterTable
ALTER TABLE "transcription_jobs" ADD COLUMN "preferred_model" TEXT;
