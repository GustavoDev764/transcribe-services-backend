/*
  Warnings:

  - You are about to drop the `system_config` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "transcription_jobs" ADD COLUMN     "responses" JSONB;

-- DropTable
DROP TABLE "system_config";
