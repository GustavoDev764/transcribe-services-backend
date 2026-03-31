-- Drop old tables and types
DROP TABLE IF EXISTS "ai_usage_logs" CASCADE;
DROP TABLE IF EXISTS "quality_model_priority" CASCADE;
DROP TABLE IF EXISTS "quality_profiles" CASCADE;
DROP TABLE IF EXISTS "ai_models" CASCADE;
DROP TABLE IF EXISTS "provider_credentials" CASCADE;
DROP TABLE IF EXISTS "providers" CASCADE;
DROP TABLE IF EXISTS "transcription_jobs" CASCADE;
DROP TABLE IF EXISTS "ai_model_options" CASCADE;
DROP TABLE IF EXISTS "ai_token_usages" CASCADE;
DROP TABLE IF EXISTS "ai_integrations" CASCADE;
DROP TABLE IF EXISTS "files" CASCADE;
DROP TABLE IF EXISTS "folders" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "email_templates" CASCADE;
DROP TABLE IF EXISTS "system_configs" CASCADE;

DROP TYPE IF EXISTS "TranscriptionJobStatus" CASCADE;
DROP TYPE IF EXISTS "AiProvider" CASCADE;
DROP TYPE IF EXISTS "UserProfile" CASCADE;
DROP TYPE IF EXISTS "TranscriptionMode" CASCADE;
DROP TYPE IF EXISTS "ProviderName" CASCADE;
DROP TYPE IF EXISTS "AiModelType" CASCADE;
DROP TYPE IF EXISTS "Quality" CASCADE;
DROP TYPE IF EXISTS "TranscriptionStatus" CASCADE;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserProfile" AS ENUM ('CLIENT', 'MANAGER');

-- CreateEnum
CREATE TYPE "TranscriptionMode" AS ENUM ('CHITA', 'GOLFINHO', 'BALEIA');

-- CreateEnum
CREATE TYPE "ProviderName" AS ENUM ('OPENAI', 'GOOGLE_SPEECH');

-- CreateEnum
CREATE TYPE "AiModelType" AS ENUM ('TRANSCRIPTION');

-- CreateEnum
CREATE TYPE "Quality" AS ENUM ('FAST', 'BALANCED', 'ACCURATE');

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
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "url_file" TEXT NOT NULL,
    "storage_ext" TEXT NOT NULL,
    "duration" INTEGER,
    "mode" "TranscriptionMode" NOT NULL DEFAULT 'GOLFINHO',
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "transcription_text" TEXT,
    "user_id" TEXT NOT NULL,
    "folder_id" TEXT,
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
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "name" "ProviderName" NOT NULL,
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
    "name" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "type" "AiModelType" NOT NULL DEFAULT 'TRANSCRIPTION',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_profiles" (
    "id" TEXT NOT NULL,
    "code" "Quality" NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_model_priority" (
    "id" TEXT NOT NULL,
    "quality_profile_id" TEXT NOT NULL,
    "ai_model_id" TEXT NOT NULL,
    "priority_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_model_priority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcription_jobs" (
    "id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "quality_profile_id" TEXT NOT NULL,
    "status" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "provider_attempts" JSONB,
    "result_url" TEXT,
    "result_text" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcription_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "provider_credential_id" TEXT,
    "ai_model_id" TEXT,
    "quality_profile_id" TEXT,
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
CREATE UNIQUE INDEX "quality_profiles_code_key" ON "quality_profiles"("code");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_model_priority" ADD CONSTRAINT "quality_model_priority_quality_profile_id_fkey" FOREIGN KEY ("quality_profile_id") REFERENCES "quality_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_model_priority" ADD CONSTRAINT "quality_model_priority_ai_model_id_fkey" FOREIGN KEY ("ai_model_id") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_quality_profile_id_fkey" FOREIGN KEY ("quality_profile_id") REFERENCES "quality_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_provider_credential_id_fkey" FOREIGN KEY ("provider_credential_id") REFERENCES "provider_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_ai_model_id_fkey" FOREIGN KEY ("ai_model_id") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_quality_profile_id_fkey" FOREIGN KEY ("quality_profile_id") REFERENCES "quality_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
