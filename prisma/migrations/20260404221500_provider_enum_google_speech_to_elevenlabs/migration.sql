-- Corrige enum quando ainda existe GOOGLE_SPEECH (não GOOGLE): a migração
-- 20260403140000 corre *antes* de 20260403194500, logo o RENAME de GOOGLE falha
-- em bases que seguiram a ordem; 20260404210000 só tratava GOOGLE.

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON e.enumtypid = t.oid
    INNER JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'ProviderName'
      AND e.enumlabel = 'ELEVENLABS'
  ) THEN
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
    ELSIF EXISTS (
      SELECT 1
      FROM pg_enum e
      INNER JOIN pg_type t ON e.enumtypid = t.oid
      INNER JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public'
        AND t.typname = 'ProviderName'
        AND e.enumlabel = 'GOOGLE_SPEECH'
    ) THEN
      ALTER TYPE "ProviderName" RENAME VALUE 'GOOGLE_SPEECH' TO 'ELEVENLABS';
    END IF;
  END IF;
END
$migration$;

UPDATE "providers"
SET "display_name" = 'ElevenLabs'
WHERE "name"::text = 'ELEVENLABS'
  AND ("display_name" IS NULL OR "display_name" IN ('Google', 'Google Speech'));

UPDATE "transcription_jobs"
SET "provider" = 'ELEVENLABS'
WHERE "provider"::text IN ('GOOGLE', 'GOOGLE_SPEECH');
