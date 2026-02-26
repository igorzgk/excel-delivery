// src/app/api/pdf-folders/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

export const runtime = "nodejs";

async function requireSignedIn() {
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;
  const role = (session as any)?.user?.role as string | undefined;

  if (!userId) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true as const, userId, role };
}

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const folderId = ctx.params.id;

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  // 1) Find folder
  const folder = await prisma.pdfFolder.findUnique({
    where: { id: folderId },
    select: { id: true, ownerId: true },
  });

  if (!folder) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // 2) Permission check
  if (guard.role !== "ADMIN" && folder.ownerId !== guard.userId) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // 3) Update by unique id
  const updated = await prisma.pdfFolder.update({
    where: { id: folderId },
    data: { name: parsed.data.name },
    select: { id: true, name: true, ownerId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, folder: updated });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const folderId = ctx.params.id;

  // 1) Find folder
  const folder = await prisma.pdfFolder.findUnique({
    where: { id: folderId },
    select: { id: true, ownerId: true },
  });

  if (!folder) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // 2) Permission check
  if (guard.role !== "ADMIN" && folder.ownerId !== guard.userId) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // 3) Detach files first
  await prisma.file.updateMany({
    where: { pdfFolderId: folderId },
    data: { pdfFolderId: null },
  });

  // 4) Delete by unique id
  await prisma.pdfFolder.delete({
    where: { id: folderId },
  });

  return NextResponse.json({ ok: true });
}