-- AlterTable
ALTER TABLE "File" ADD COLUMN     "pdfFolderId" TEXT;

-- CreateTable
CREATE TABLE "PdfFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PdfFolder_ownerId_idx" ON "PdfFolder"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "PdfFolder_ownerId_name_key" ON "PdfFolder"("ownerId", "name");

-- AddForeignKey
ALTER TABLE "PdfFolder" ADD CONSTRAINT "PdfFolder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_pdfFolderId_fkey" FOREIGN KEY ("pdfFolderId") REFERENCES "PdfFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
