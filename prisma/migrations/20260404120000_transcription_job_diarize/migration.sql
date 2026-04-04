-- AlterTable
ALTER TABLE "transcription_jobs" ADD COLUMN "diarize_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "transcription_jobs" ADD COLUMN "diarize_speaker_count" INTEGER;
