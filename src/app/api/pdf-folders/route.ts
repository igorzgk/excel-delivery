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
  const role = (session as any)?.user?.role as "USER" | "ADMIN" | undefined;

  if (!userId) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true as const, userId, role };
}

// ---------- GET ----------
export async function GET() {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const where = guard.role === "ADMIN" ? {} : { ownerId: guard.userId };

  const folders = await prisma.pdfFolder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, ownerId: true },
  });

  return NextResponse.json({ ok: true, folders }, { headers: { "Cache-Control": "no-store" } });
}

// ---------- POST ----------
const CreateSchema = z.object({
  name: z.string().trim().min(1, "Το όνομα φακέλου είναι υποχρεωτικό.").max(80),
});

export async function POST(req: Request) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const name = parsed.data.name.trim();

  // Duplicates check (ανά owner)
  const exists = await prisma.pdfFolder.findFirst({
    where: { ownerId: guard.userId, name },
    select: { id: true },
  });
  if (exists) return NextResponse.json({ ok: false, error: "folder_exists" }, { status: 409 });

  const folder = await prisma.pdfFolder.create({
    data: { name, ownerId: guard.userId },
    select: { id: true, name: true, createdAt: true, ownerId: true },
  });

  return NextResponse.json({ ok: true, folder }, { status: 201 });
}

// ---------- PUT ----------
const UpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export async function PUT(req: Request) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const id = parsed.data.id;
  const name = parsed.data.name.trim();

  // ✅ Authorization check (admin όλα, user μόνο δικά του)
  const canEdit = await prisma.pdfFolder.findFirst({
    where: guard.role === "ADMIN" ? { id } : { id, ownerId: guard.userId },
    select: { id: true },
  });
  if (!canEdit) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // ✅ Update uses UNIQUE where (id)
  const folder = await prisma.pdfFolder.update({
    where: { id },
    data: { name },
    select: { id: true, name: true, createdAt: true, ownerId: true },
  });

  return NextResponse.json({ ok: true, folder });
}

// ---------- DELETE ----------
const DeleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: Request) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const id = parsed.data.id;

  // ✅ Authorization check
  const canDelete = await prisma.pdfFolder.findFirst({
    where: guard.role === "ADMIN" ? { id } : { id, ownerId: guard.userId },
    select: { id: true },
  });
  if (!canDelete) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // ✅ Αν έχεις field pdfFolderId στο File, set null πριν delete folder
  // (Αν ΔΕΝ υπάρχει στο schema/db, θα σκάσει — δες βήμα 2 παρακάτω)
  await prisma.file.updateMany({
    where: { pdfFolderId: id } as any,
    data: { pdfFolderId: null } as any,
  });

  await prisma.pdfFolder.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
