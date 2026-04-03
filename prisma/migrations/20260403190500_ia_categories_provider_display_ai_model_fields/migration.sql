-- CreateTable
CREATE TABLE "ia_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ia_categories_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "providers" ADD COLUMN "display_name" TEXT;

-- AlterTable
ALTER TABLE "ai_models" ADD COLUMN "url_icone" TEXT;
ALTER TABLE "ai_models" ADD COLUMN "category_id" TEXT;

-- CreateIndex
CREATE INDEX "ai_models_category_id_idx" ON "ai_models"("category_id");

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ia_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
