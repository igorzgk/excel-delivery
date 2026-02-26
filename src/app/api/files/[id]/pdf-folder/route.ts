import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  // Accept: null | "cuid" | ""  ("" => null)
  pdfFolderId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().nullable()
  ),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireRole("USER");
  if (!guard.ok) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: guard.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  const userId = guard.user.id;
  const fileId = ctx.params.id;

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { pdfFolderId } = parsed.data;

  // file must exist and be visible to user (uploadedBy or assigned)
  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      OR: [{ uploadedById: userId }, { assignments: { some: { userId } } }],
    },
    select: { id: true, mime: true, originalName: true },
  });

  if (!file) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  // only allow foldering for PDFs (mime or extension)
  const isPdf =
    (file.mime || "").toLowerCase().includes("pdf") ||
    (file.originalName || "").toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return NextResponse.json(
      { ok: false, error: "not_pdf" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (pdfFolderId) {
    // folder must belong to user
    const folder = await prisma.pdfFolder.findFirst({
      where: { id: pdfFolderId, ownerId: userId },
      select: { id: true },
    });
    if (!folder) {
      return NextResponse.json(
        { ok: false, error: "folder_not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  const updated = await prisma.file.update({
    where: { id: fileId },
    data: { pdfFolderId },
    select: { id: true, pdfFolderId: true },
  });

  return NextResponse.json(
    { ok: true, file: updated },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}