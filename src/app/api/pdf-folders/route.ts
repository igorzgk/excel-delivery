// src/app/api/pdf-folders/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // <-- βεβαιώσου ότι υπάρχει αυτό το file
import { z } from "zod";

export const runtime = "nodejs";

async function requireSignedIn() {
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;
  const role = (session as any)?.user?.role as string | undefined;

  if (!userId) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  }
  return { ok: true as const, userId, role };
}

export async function GET() {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  // ✅ Admin βλέπει όλα, User βλέπει μόνο τα δικά του
  const where =
    guard.role === "ADMIN"
      ? {}
      : { ownerId: guard.userId };

  const folders = await prisma.pdfFolder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, ownerId: true },
  });

  return NextResponse.json({ ok: true, folders }, { headers: { "Cache-Control": "no-store" } });
}

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Το όνομα φακέλου είναι υποχρεωτικό.").max(80),
});

export async function POST(req: Request) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // ✅ Αποφυγή duplicates για ίδιο owner (προαιρετικό)
  const exists = await prisma.pdfFolder.findFirst({
    where: { ownerId: guard.userId, name: parsed.data.name },
    select: { id: true },
  });
  if (exists) {
    return NextResponse.json(
      { ok: false, error: "folder_exists" },
      { status: 409 }
    );
  }

  const folder = await prisma.pdfFolder.create({
    data: {
      name: parsed.data.name,
      ownerId: guard.userId,
    },
    select: { id: true, name: true, createdAt: true, ownerId: true },
  });

  return NextResponse.json({ ok: true, folder }, { status: 201 });
}

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
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // ✅ User μπορεί να πειράξει μόνο δικά του, Admin όλα
  const where =
    guard.role === "ADMIN"
      ? { id: parsed.data.id }
      : { id: parsed.data.id, ownerId: guard.userId };

  const folder = await prisma.pdfFolder.update({
    where,
    data: { name: parsed.data.name },
    select: { id: true, name: true, createdAt: true, ownerId: true },
  });

  return NextResponse.json({ ok: true, folder });
}

const DeleteSchema = z.object({
  id: z.string().min(1),
});

export async function DELETE(req: Request) {
  const guard = await requireSignedIn();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  // ✅ User delete μόνο δικά του, Admin όλα
  const where =
    guard.role === "ADMIN"
      ? { id: parsed.data.id }
      : { id: parsed.data.id, ownerId: guard.userId };

  // Αν έχεις pdf files μέσα, προτείνω SetNull πριν delete folder
  await prisma.file.updateMany({
    where: { pdfFolderId: parsed.data.id },
    data: { pdfFolderId: null },
  });

  await prisma.pdfFolder.delete({ where });

  return NextResponse.json({ ok: true });
}
