import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireRole("USER");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const ownerId = guard.user.id;
  const folderId = ctx.params.id;

  const Schema = z.object({
    name: z.string().trim().min(1).max(60),
  });

  const body = await req.json().catch(() => ({}));
  const { name } = Schema.parse(body);

  // ensure ownership
  const existing = await prisma.pdfFolder.findFirst({ where: { id: folderId, ownerId }, select: { id: true } });
  if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  try {
    const folder = await prisma.pdfFolder.update({
      where: { id: folderId },
      data: { name },
      select: { id: true, name: true },
    });

    return NextResponse.json({ ok: true, folder });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "rename_failed", detail: e?.message || "Rename failed" },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const guard = await requireRole("USER");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const ownerId = guard.user.id;
  const folderId = ctx.params.id;

  const existing = await prisma.pdfFolder.findFirst({ where: { id: folderId, ownerId }, select: { id: true } });
  if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // detach PDFs from folder (do NOT delete files)
    await tx.file.updateMany({
      where: { pdfFolderId: folderId },
      data: { pdfFolderId: null },
    });

    await tx.pdfFolder.delete({ where: { id: folderId } });
  });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
