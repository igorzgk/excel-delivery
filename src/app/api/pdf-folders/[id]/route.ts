// src/app/api/pdf-folders/route.ts
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

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  userId: z.string().trim().min(1).optional(), // ✅ only used by ADMIN
});

export async function GET(req: Request) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get("userId")?.trim() || undefined;

  // ✅ Admin can query folders for any user, normal user only self
  const ownerId = guard.role === "ADMIN" ? (userIdParam ?? guard.userId) : guard.userId;

  const folders = await prisma.pdfFolder.findMany({
    where: { ownerId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, ownerId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, folders });
}

export async function POST(req: Request) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const name = parsed.data.name;
  const ownerId = guard.role === "ADMIN" ? (parsed.data.userId ?? guard.userId) : guard.userId;

  // ✅ Prevent "global folder": always ownerId-scoped
  const exists = await prisma.pdfFolder.findFirst({
    where: { ownerId, name },
    select: { id: true },
  });
  if (exists) {
    return NextResponse.json({ ok: false, error: "folder_exists" }, { status: 409 });
  }

  const folder = await prisma.pdfFolder.create({
    data: { name, ownerId },
    select: { id: true, name: true, ownerId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, folder }, { status: 201 });
}