// src/app/api/pdf-folders/move/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const Schema = z.object({
  fileId: z.string().min(1),
  pdfFolderId: z.string().nullable(), // null => remove from folder
});

export async function POST(req: Request) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { fileId, pdfFolderId } = parsed.data;

  const updated = await prisma.file.update({
    where: { id: fileId },
    data: { pdfFolderId },
    select: { id: true, pdfFolderId: true },
  });

  return NextResponse.json({ ok: true, file: updated });
}
