-- Renomeia o valor do enum (PostgreSQL 10+); atualiza linhas existentes na tabela providers.
ALTER TYPE "ProviderName" RENAME VALUE 'GOOGLE' TO 'ELEVENLABS';

UPDATE "providers"
SET "display_name" = 'ElevenLabs'
WHERE "name" = 'ELEVENLABS';

UPDATE "ai_models"
SET
  "name" = 'ElevenLabs Scribe v2',
  "model_name" = 'scribe_v2'
WHERE "id" = 'google-fast';

UPDATE "ai_models"
SET
  "name" = 'ElevenLabs Scribe v1',
  "model_name" = 'scribe_v1'
WHERE "id" = 'google-accurate';

UPDATE "transcription_jobs"
SET "provider" = 'ELEVENLABS'
WHERE "provider" = 'GOOGLE';
