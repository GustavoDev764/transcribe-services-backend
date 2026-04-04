DROP INDEX IF EXISTS "ia_categories_key_key";

ALTER TABLE "ia_categories" DROP COLUMN IF EXISTS "key";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ia_categories'
      AND column_name = 'kind'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ia_categories'
      AND column_name = 'tipo'
  ) THEN
    ALTER TABLE "ia_categories" RENAME COLUMN "kind" TO "tipo";
  END IF;
END $$;
