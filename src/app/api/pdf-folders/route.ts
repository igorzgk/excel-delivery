import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers"; // use your existing helper (or swap with your auth)
import { z } from "zod";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().min(1).max(60),
});

export async function GET() {
  const guard = await requireAuth(); // must return { ok, userId, role } (adjust if your helper differs)
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Admin sees all folders, User sees own + shared (ownerId=null)
  const where =
    guard.role === "ADMIN"
      ? {}
      : { OR: [{ ownerId: guard.userId }, { ownerId: null }] };

  const folders = await prisma.pdfFolder.findMany({
    where,
    orderBy: [{ ownerId: "asc" }, { name: "asc" }],
    select: { id: true, name: true, ownerId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, folders }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const guard = await requireAuth();
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data = CreateSchema.safeParse(body);
  if (!data.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const folder = await prisma.pdfFolder.create({
    data: {
      name: data.data.name.trim(),
      ownerId: guard.role === "ADMIN" ? null : guard.userId, // admin creates shared folder; user creates own
    },
    select: { id: true, name: true, ownerId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, folder }, { status: 201 });
}
