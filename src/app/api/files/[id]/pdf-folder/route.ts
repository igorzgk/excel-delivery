import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireRole("USER");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const userId = guard.user.id;
  const fileId = ctx.params.id;

  const Schema = z.object({
    pdfFolderId: z.string().nullable(), // null => no folder
  });

  const body = await req.json().catch(() => ({}));
  const { pdfFolderId } = Schema.parse(body);

  // file must exist and be visible to user (uploadedBy or assigned)
  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      OR: [
        { uploadedById: userId },
        { assignments: { some: { userId } } }, // assumes File has assignments relation
      ],
    },
    select: { id: true, mime: true, originalName: true },
  });

  if (!file) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // only allow foldering for PDFs (mime or extension)
  const isPdf =
    (file.mime || "").toLowerCase().includes("pdf") ||
    (file.originalName || "").toLowerCase().endsWith(".pdf");

  if (!isPdf) return NextResponse.json({ ok: false, error: "not_pdf" }, { status: 400 });

  if (pdfFolderId) {
    // folder must belong to user
    const folder = await prisma.pdfFolder.findFirst({
      where: { id: pdfFolderId, ownerId: userId },
      select: { id: true },
    });
    if (!folder) return NextResponse.json({ ok: false, error: "folder_not_found" }, { status: 404 });
  }

  const updated = await prisma.file.update({
    where: { id: fileId },
    data: { pdfFolderId },
    select: { id: true, pdfFolderId: true },
  });

  return NextResponse.json({ ok: true, file: updated }, { headers: { "Cache-Control": "no-store" } });
}
