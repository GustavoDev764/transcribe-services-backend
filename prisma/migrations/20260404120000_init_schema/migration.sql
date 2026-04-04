DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;

-- CreateEnum
CREATE TYPE "UserProfile" AS ENUM ('CLIENT', 'MANAGER');

-- CreateEnum
CREATE TYPE "TranscriptionMode" AS ENUM ('CHITA', 'GOLFINHO', 'BALEIA');

-- CreateEnum
CREATE TYPE "FileTranscriptionStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "UploadBatchStatus" AS ENUM ('NEW', 'FINISH');

-- CreateEnum
CREATE TYPE "ProviderName" AS ENUM ('OPENAI', 'ELEVENLABS', 'TRANSCRIBE_SERVICES');

-- CreateEnum
CREATE TYPE "AiModelType" AS ENUM ('TRANSCRIPTION');

-- CreateEnum
CREATE TYPE "IaCategoryKind" AS ENUM ('text_generation', 'audio_and_speech');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profile" "UserProfile" NOT NULL DEFAULT 'CLIENT',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#60A5FA',
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "UploadBatchStatus" NOT NULL DEFAULT 'NEW',

    CONSTRAINT "upload_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "url_file" TEXT NOT NULL,
    "storage_ext" TEXT NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER,
    "mode" "TranscriptionMode" NOT NULL DEFAULT 'GOLFINHO',
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "transcription_text" TEXT,
    "transcription_status" "FileTranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "user_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tipo" "IaCategoryKind" NOT NULL DEFAULT 'text_generation',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "name" "ProviderName" NOT NULL,
    "display_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_credentials" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "subtitle" TEXT,
    "text_tooltip" TEXT,
    "url_icone" TEXT,
    "icon_file_name" TEXT,
    "type" "AiModelType" NOT NULL DEFAULT 'TRANSCRIPTION',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcription_jobs" (
    "id" TEXT NOT NULL,
    "file_id" TEXT,
    "file_url" TEXT NOT NULL,
    "provider" TEXT,
    "job_id" TEXT,
    "preferred_model" TEXT,
    "diarize_enabled" BOOLEAN NOT NULL DEFAULT false,
    "diarize_speaker_count" INTEGER,
    "status" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "provider_attempts" JSONB,
    "responses" JSONB,
    "result_url" TEXT,
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_status_check_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcription_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcription_job_audit_logs" (
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

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "provider_credential_id" TEXT,
    "ai_model_id" TEXT,
    "tokens" INTEGER,
    "cost_total" DOUBLE PRECISION,
    "status" "TranscriptionStatus" NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "providers_name_key" ON "providers"("name");

-- CreateIndex
CREATE INDEX "ai_models_category_id_idx" ON "ai_models"("category_id");

-- CreateIndex
CREATE INDEX "transcription_jobs_file_id_idx" ON "transcription_jobs"("file_id");

-- CreateIndex
CREATE INDEX "transcription_jobs_provider_idx" ON "transcription_jobs"("provider");

-- CreateIndex
CREATE INDEX "transcription_jobs_status_idx" ON "transcription_jobs"("status");

-- CreateIndex
CREATE INDEX "transcription_jobs_job_id_idx" ON "transcription_jobs"("job_id");

-- CreateIndex
CREATE INDEX "transcription_job_audit_logs_transcription_job_id_idx" ON "transcription_job_audit_logs"("transcription_job_id");

-- CreateIndex
CREATE INDEX "transcription_job_audit_logs_user_id_idx" ON "transcription_job_audit_logs"("user_id");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "upload_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ia_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcription_job_audit_logs" ADD CONSTRAINT "transcription_job_audit_logs_transcription_job_id_fkey" FOREIGN KEY ("transcription_job_id") REFERENCES "transcription_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcription_job_audit_logs" ADD CONSTRAINT "transcription_job_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_provider_credential_id_fkey" FOREIGN KEY ("provider_credential_id") REFERENCES "provider_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_ai_model_id_fkey" FOREIGN KEY ("ai_model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
