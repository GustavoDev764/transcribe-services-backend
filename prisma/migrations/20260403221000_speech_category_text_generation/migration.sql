-- Modelos de transcrição no cliente usam categoria tipo text_generation
UPDATE "ia_categories"
SET "tipo" = 'text_generation'
WHERE "id" = 'c0000000-0000-4000-8000-000000000001';
