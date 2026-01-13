// src/app/api/auth/reset-password/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  let data: z.infer<typeof BodySchema>;
  try {
    data = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const tokenHash = sha256(data.token);

  const rec = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!rec || rec.usedAt) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }

  if (rec.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "expired_token" }, { status: 400 });
  }

  const hash = await bcrypt.hash(data.password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: rec.userId },
      data: { passwordHash: hash },
    }),
    prisma.passwordResetToken.update({
      where: { id: rec.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
