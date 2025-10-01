import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

const prisma = new PrismaClient();

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions as any);
  const role = (session?.user as any)?.role;
  if (!session?.user || role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = z.object({ active: z.boolean() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { subscriptionActive: parsed.data.active },
    select: { id: true, subscriptionActive: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "SUBSCRIPTION_TOGGLED",
      actorId: (session.user as any).id,
      targetId: user.id,
      target: "User",
      meta: { to: user.subscriptionActive },
    },
  });

  return NextResponse.json(user);
}
