-- CreateEnum
CREATE TYPE "IaCategoryKind" AS ENUM ('text_generation', 'audio_and_speech');

-- AlterTable
ALTER TABLE "ia_categories" ADD COLUMN "key" TEXT;
ALTER TABLE "ia_categories" ADD COLUMN "kind" "IaCategoryKind" NOT NULL DEFAULT 'text_generation';

-- Backfill key (evita NULL antes do NOT NULL)
UPDATE "ia_categories" SET "key" = 'speech_to_text' WHERE "id" = 'c0000000-0000-4000-8000-000000000001';
UPDATE "ia_categories" SET "key" = 'cat_' || REPLACE("id"::text, '-', '') WHERE "key" IS NULL;

ALTER TABLE "ia_categories" ALTER COLUMN "key" SET NOT NULL;

CREATE UNIQUE INDEX "ia_categories_key_key" ON "ia_categories"("key");

UPDATE "ia_categories" SET "kind" = 'audio_and_speech' WHERE "key" = 'speech_to_text';
