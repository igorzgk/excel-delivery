import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireRole("USER"); // any logged-in
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const ownerId = guard.user.id;

  const folders = await prisma.pdfFolder.findMany({
    where: { ownerId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, folders }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const guard = await requireRole("USER");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const ownerId = guard.user.id;

  const Schema = z.object({
    name: z.string().trim().min(1, "required").max(60),
  });

  const body = await req.json().catch(() => ({}));
  const { name } = Schema.parse(body);

  try {
    const folder = await prisma.pdfFolder.create({
      data: { name, ownerId },
      select: { id: true, name: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, folder }, { status: 201 });
  } catch (e: any) {
    // unique conflict per ownerId+name
    return NextResponse.json(
      { ok: false, error: "folder_exists", detail: e?.message || "Folder already exists" },
      { status: 400 }
    );
  }
}
