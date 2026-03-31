-- AlterTable
ALTER TABLE "transcription_jobs"
  ADD COLUMN IF NOT EXISTS "file_id" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "job_id" TEXT,
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_status_check_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finished_at" TIMESTAMP(3);

-- Indexes
CREATE INDEX IF NOT EXISTS "transcription_jobs_file_id_idx" ON "transcription_jobs"("file_id");
CREATE INDEX IF NOT EXISTS "transcription_jobs_provider_idx" ON "transcription_jobs"("provider");
CREATE INDEX IF NOT EXISTS "transcription_jobs_status_idx" ON "transcription_jobs"("status");
CREATE INDEX IF NOT EXISTS "transcription_jobs_job_id_idx" ON "transcription_jobs"("job_id");
