import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser, requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const items = await prisma.fileAssignment.findMany({
    where: { userId: (me as any).id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, note: true, createdAt: true,
      file: { select: { id: true, title: true, url: true, originalName: true } },
      assignedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ assignments: items });
}

const CreateSchema = z.object({
  fileId: z.string().min(1),
  userId: z.string().min(1),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const body = await req.json();
  const data = CreateSchema.parse(body);

  const created = await prisma.fileAssignment.create({
    data: {
      fileId: data.fileId,
      userId: data.userId,
      note: data.note,
      assignedById: (guard.user as any).id,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ assignment: created }, { status: 201 });
}
