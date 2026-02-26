import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const fileId = ctx.params.id;

  const exists = await prisma.file.findUnique({
    where: { id: fileId },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Διαγράφει τη DB εγγραφή. Τα FileAssignment σβήνονται λόγω Cascade.
  await prisma.file.delete({ where: { id: fileId } });

  return NextResponse.json({ ok: true }, { status: 200 });
}