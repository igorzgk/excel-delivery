import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const UpdateSchema = z.object({
  name: z.string().min(1).max(60),
});

async function canAccessFolder(folderId: string, userId: string, role: string) {
  const folder = await prisma.pdfFolder.findUnique({
    where: { id: folderId },
    select: { id: true, ownerId: true },
  });
  if (!folder) return { ok: false, status: 404 as const };
  if (role === "ADMIN") return { ok: true, folder };
  // user can access own folders OR shared folders
  if (folder.ownerId === null || folder.ownerId === userId) return { ok: true, folder };
  return { ok: false, status: 403 as const };
}

export async function PUT(req: Request, ctx: Ctx) {
  const guard = await requireAuth();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const access = await canAccessFolder(id, guard.userId, guard.role);
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: access.status });

  // users cannot rename shared folders (ownerId=null), only admin can
  if (guard.role !== "ADMIN" && access.folder.ownerId === null) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const folder = await prisma.pdfFolder.update({
    where: { id },
    data: { name: parsed.data.name.trim() },
    select: { id: true, name: true, ownerId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, folder });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await requireAuth();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const access = await canAccessFolder(id, guard.userId, guard.role);
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: access.status });

  // users cannot delete shared folders, only admin can
  if (guard.role !== "ADMIN" && access.folder.ownerId === null) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    // detach files first
    await tx.file.updateMany({ where: { pdfFolderId: id }, data: { pdfFolderId: null } });
    await tx.pdfFolder.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
