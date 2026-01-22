import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const MoveSchema = z.object({
  fileId: z.string().min(1),
  folderId: z.string().nullable(), // null = move out of folder
});

export async function POST(req: Request) {
  const guard = await requireAuth();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = MoveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const file = await prisma.file.findUnique({
    where: { id: parsed.data.fileId },
    select: { id: true, mime: true, uploadedById: true },
  });
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // allow only PDF
  const isPdf = (file.mime || "").toLowerCase().includes("pdf");
  if (!isPdf) return NextResponse.json({ error: "not_pdf" }, { status: 400 });

  // admin can move any; user only their uploaded ones (or you can extend to "assigned" logic)
  if (guard.role !== "ADMIN" && file.uploadedById !== guard.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // if folderId provided, ensure folder exists and is accessible
  if (parsed.data.folderId) {
    const folder = await prisma.pdfFolder.findUnique({
      where: { id: parsed.data.folderId },
      select: { id: true, ownerId: true },
    });
    if (!folder) return NextResponse.json({ error: "folder_not_found" }, { status: 404 });

    if (guard.role !== "ADMIN") {
      if (!(folder.ownerId === null || folder.ownerId === guard.userId)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }
  }

  await prisma.file.update({
    where: { id: parsed.data.fileId },
    data: { pdfFolderId: parsed.data.folderId },
  });

  return NextResponse.json({ ok: true });
}
