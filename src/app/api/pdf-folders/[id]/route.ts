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

  // ✅ Admin edits all. User edits only own.
  const where =
    guard.role === "ADMIN"
      ? { id: folderId }
      : { id: folderId, ownerId: guard.userId };

  const folder = await prisma.pdfFolder.update({
    where,
    data: { name: parsed.data.name },
    select: { id: true, name: true, ownerId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, folder });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const folderId = ctx.params.id;

  // ✅ Admin deletes all. User deletes only own.
  const where =
    guard.role === "ADMIN"
      ? { id: folderId }
      : { id: folderId, ownerId: guard.userId };

  // detach pdfs first
  await prisma.file.updateMany({
    where: { pdfFolderId: folderId },
    data: { pdfFolderId: null },
  });

  await prisma.pdfFolder.delete({ where });

  return NextResponse.json({ ok: true });
}
