// src/app/api/profile/password/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// IMPORTANT: adjust this import to your authOptions location.
// If you already have authOptions exported somewhere else, change it accordingly.
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";

const BodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "wrong_password" }, { status: 400 });
  }

  const hash = await bcrypt.hash(body.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash },
  });

  return NextResponse.json({ ok: true });
}
