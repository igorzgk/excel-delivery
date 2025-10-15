/*
  Warnings:

  - You are about to drop the column `mimeType` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `sha256` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `sizeBytes` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `storagePath` on the `File` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[fileId,userId]` on the table `FileAssignment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `title` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."File" DROP CONSTRAINT "File_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."FileAssignment" DROP CONSTRAINT "FileAssignment_fileId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FileAssignment" DROP CONSTRAINT "FileAssignment_userId_fkey";

-- DropIndex
DROP INDEX "public"."FileAssignment_userId_fileId_key";

-- AlterTable
ALTER TABLE "public"."File" DROP COLUMN "mimeType",
DROP COLUMN "sha256",
DROP COLUMN "sizeBytes",
DROP COLUMN "storagePath",
ADD COLUMN     "mime" TEXT,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "url" TEXT,
ALTER COLUMN "originalName" DROP NOT NULL,
ALTER COLUMN "uploadedById" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "public"."AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "File_uploadedById_idx" ON "public"."File"("uploadedById");

-- CreateIndex
CREATE INDEX "File_createdAt_idx" ON "public"."File"("createdAt");

-- CreateIndex
CREATE INDEX "FileAssignment_userId_createdAt_idx" ON "public"."FileAssignment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FileAssignment_assignedById_idx" ON "public"."FileAssignment"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "FileAssignment_fileId_userId_key" ON "public"."FileAssignment"("fileId", "userId");

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FileAssignment" ADD CONSTRAINT "FileAssignment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FileAssignment" ADD CONSTRAINT "FileAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
