// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ProfileInputSchema } from "@/lib/businessProfile";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const p = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ ok: true, profile: p });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try { body = ProfileInputSchema.parse(await req.json()); }
  catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }

  const exists = await prisma.userProfile.findUnique({ where: { userId: session.user.id } });
  const data = {
    businessName: body.businessName,
    businessTypes: body.businessTypes,
    equipmentCount: body.equipmentCount ?? null,
    hasDryAged: body.hasDryAged ?? null,
    supervisorInitials: body.supervisorInitials ?? null,
    equipmentFlags: body.equipmentFlags ?? {},
  };

  const profile = exists
    ? await prisma.userProfile.update({ where: { userId: session.user.id }, data })
    : await prisma.userProfile.create({ data: { userId: session.user.id, ...data } });

  return NextResponse.json({ ok: true, profile });
}
