// src/app/api/admin/users/[id]/password/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// IMPORTANT: adjust this import to your authOptions location.
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";

const BodySchema = z.object({
  newPassword: z.string().min(6),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // must be admin
  const admin = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (admin?.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const hash = await bcrypt.hash(body.newPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash: hash },
  });

  return NextResponse.json({ ok: true });
}
