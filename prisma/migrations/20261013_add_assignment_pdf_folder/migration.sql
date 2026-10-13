ALTER TABLE "FileAssignment"
ADD COLUMN "pdfFolderId" TEXT;

CREATE INDEX "FileAssignment_pdfFolderId_idx"
ON "FileAssignment"("pdfFolderId");

ALTER TABLE "FileAssignment"
ADD CONSTRAINT "FileAssignment_pdfFolderId_fkey"
FOREIGN KEY ("pdfFolderId")
REFERENCES "PdfFolder"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;