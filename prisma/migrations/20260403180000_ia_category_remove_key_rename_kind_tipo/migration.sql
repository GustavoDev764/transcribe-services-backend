-- DropIndex
DROP INDEX IF EXISTS "ia_categories_key_key";

-- AlterTable
ALTER TABLE "ia_categories" DROP COLUMN IF EXISTS "key";

-- AlterTable
ALTER TABLE "ia_categories" RENAME COLUMN "kind" TO "tipo";
