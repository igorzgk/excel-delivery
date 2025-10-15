import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser, requireRole } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get("scope") || "mine") as "mine" | "assigned" | "all";
  const isAdmin = (me as any).role === "ADMIN";

  let where: any = {};
  if (isAdmin) {
    if (scope === "mine") where = { uploadedById: (me as any).id };
    else if (scope === "assigned") {
      const ids = (await prisma.fileAssignment.findMany({
        where: { userId: (me as any).id }, select: { fileId: true }
      })).map(a => a.fileId);
      where = { id: { in: ids } };
    } else { where = {}; } // all
  } else {
    if (scope === "assigned") {
      const ids = (await prisma.fileAssignment.findMany({
        where: { userId: (me as any).id }, select: { fileId: true }
      })).map(a => a.fileId);
      where = { id: { in: ids } };
    } else { // default to mine
      where = { uploadedById: (me as any).id };
    }
  }

  const files = await prisma.file.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, originalName: true, url: true, mime: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, name: true, email: true } }
    },
  });

  return NextResponse.json({ files });
}

// 🚫 No public POST here anymore unless admin explicitly uses it
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
    select: { id: true, title: true, createdAt: true }
  });

  return NextResponse.json({ file }, { status: 201 });
}
