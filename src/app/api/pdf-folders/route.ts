// src/app/api/pdf-folders/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
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

export async function GET() {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const where = guard.role === "ADMIN" ? {} : { ownerId: guard.userId };

  const folders = await prisma.pdfFolder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, ownerId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, folders }, { headers: { "Cache-Control": "no-store" } });
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  // ✅ admin can optionally create folder for another user
  ownerId: z.string().optional(),
});

export async function POST(req: Request) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const targetOwnerId =
    guard.role === "ADMIN" && parsed.data.ownerId ? parsed.data.ownerId : guard.userId;

  // prevent duplicates per owner
  const exists = await prisma.pdfFolder.findFirst({
    where: { ownerId: targetOwnerId, name: parsed.data.name },
    select: { id: true },
  });
  if (exists) {
    return NextResponse.json({ ok: false, error: "folder_exists" }, { status: 409 });
  }

  const folder = await prisma.pdfFolder.create({
    data: { name: parsed.data.name, ownerId: targetOwnerId },
    select: { id: true, name: true, ownerId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, folder }, { status: 201 });
}
