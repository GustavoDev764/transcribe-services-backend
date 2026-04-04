-- Garante enum "ProviderName" com ELEVENLABS no PostgreSQL.
-- Corrige bases onde a migração 20260403140000 não foi aplicada (enum ainda tem GOOGLE).

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON e.enumtypid = t.oid
    INNER JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'ProviderName'
      AND e.enumlabel = 'GOOGLE'
  ) THEN
    ALTER TYPE "ProviderName" RENAME VALUE 'GOOGLE' TO 'ELEVENLABS';
  END IF;
END
$migration$;

UPDATE "providers"
SET "display_name" = 'ElevenLabs'
WHERE "name"::text = 'ELEVENLABS'
  AND ("display_name" IS NULL OR "display_name" = 'Google');

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
