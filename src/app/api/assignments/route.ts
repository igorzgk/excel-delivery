import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, currentUser } from "@/lib/auth-helpers";
import { z } from "zod";

const Schema = z.object({
  fileId: z.string().min(1),
  userId: z.string().min(1),
});

export async function POST(req: Request) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { fileId, userId } = Schema.parse(body);

  // optional: prevent duplicates (same file -> same user)
  const exists = await prisma.fileAssignment.findFirst({
    where: { fileId, userId },
    select: { id: true },
  });
  if (exists) return NextResponse.json({ ok: true, id: exists.id });

  const created = await prisma.fileAssignment.create({
    data: {
      file: { connect: { id: fileId } },
      user: { connect: { id: userId } },
      assignedBy: { connect: { id: (me as any).id } }, // ✅ REQUIRED
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
