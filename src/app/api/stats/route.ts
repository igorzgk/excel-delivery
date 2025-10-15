import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth-helpers";

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const role = (me as any).role;

  if (role === "ADMIN") {
    const [users, pending, files] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "PENDING" } }),
      prisma.file.count(),
    ]);
    return NextResponse.json({ users, pending, files });
  }

  // USER stats
  const [myFiles, myAssigned] = await Promise.all([
    prisma.file.count({ where: { uploadedById: (me as any).id } }),
    prisma.fileAssignment.count({ where: { userId: (me as any).id } }),
  ]);
  return NextResponse.json({ myFiles, myAssigned });
}
