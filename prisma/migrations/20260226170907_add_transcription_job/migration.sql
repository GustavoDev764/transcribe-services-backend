/*
  Warnings:

  - You are about to drop the column `srtPath` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `transcriptionStatus` on the `File` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TranscriptionJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "File" DROP COLUMN "srtPath",
DROP COLUMN "transcriptionStatus",
ADD COLUMN     "transcriptionText" TEXT;

-- CreateTable
CREATE TABLE "TranscriptionJob" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" "TranscriptionJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptionJob_fileId_key" ON "TranscriptionJob"("fileId");

-- AddForeignKey
ALTER TABLE "TranscriptionJob" ADD CONSTRAINT "TranscriptionJob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
