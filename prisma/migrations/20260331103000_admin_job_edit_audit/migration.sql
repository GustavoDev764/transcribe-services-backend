CREATE TABLE IF NOT EXISTS "transcription_job_audit_logs" (
  "id" TEXT NOT NULL,
  "transcription_job_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "previous_status" "TranscriptionStatus",
  "new_status" "TranscriptionStatus",
  "previous_responses" JSONB,
  "new_responses" JSONB,
  "previous_error_message" TEXT,
  "new_error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transcription_job_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "transcription_job_audit_logs_job_id_idx" ON "transcription_job_audit_logs"("transcription_job_id");
CREATE INDEX IF NOT EXISTS "transcription_job_audit_logs_user_id_idx" ON "transcription_job_audit_logs"("user_id");

DO $$ BEGIN
  ALTER TABLE "transcription_job_audit_logs"
    ADD CONSTRAINT "transcription_job_audit_logs_transcription_job_id_fkey"
    FOREIGN KEY ("transcription_job_id") REFERENCES "transcription_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "transcription_job_audit_logs"
    ADD CONSTRAINT "transcription_job_audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
