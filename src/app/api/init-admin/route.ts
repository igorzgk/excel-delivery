// src/app/api/init-admin/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const expected = process.env.INIT_ADMIN_TOKEN || "";

  if (!expected || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const name = process.env.ADMIN_NAME || "Admin";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      subscriptionActive: true,
    },
    create: {
      name,
      email,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      subscriptionActive: true,
    },
  });

  return NextResponse.json({
    ok: true,
    createdOrUpdated: user.email,
    loginWith: { email, password },
  });
}
