// src/app/api/files/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser, requireRole } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope"); // "all" for admin view, otherwise user's files
  const isAdmin = (me as any).role === "ADMIN" && scope === "all";

  const where = isAdmin
    ? undefined
    : {
        // for users: show uploads they made OR assignments to them
        OR: [
          { uploadedById: (me as any).id },
          { assignments: { some: { userId: (me as any).id } } },
        ],
      };

  const files = await prisma.file.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      originalName: true,
      url: true,
      mime: true,
      size: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      ...(isAdmin
        ? {
            assignments: {
              select: { user: { select: { id: true, email: true, name: true } } },
            },
          }
        : {}),
    },
  });

  return NextResponse.json({ files });
}

// Admin-only manual create (rarely used; your UIs mostly use POST /api/uploads)
export async function POST(req: Request) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const body = await req.json().catch(() => ({}));
  const file = await prisma.file.create({
    data: {
      title: body.title ?? "Untitled",
      url: body.url,
      originalName: body.originalName,
      mime: body.mime,
      size: body.size,
      uploadedById: (guard.user as any).id,
    },
    select: { id: true, title: true, createdAt: true },
  });

  return NextResponse.json({ file }, { status: 201 });
}
