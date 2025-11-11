// src/app/api/admin/users/[id]/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ProfileInputSchema } from "@/lib/businessProfile";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false as const, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin(); if (!gate.ok) return gate.res;
  const p = await prisma.userProfile.findUnique({ where: { userId: params.id } });
  return NextResponse.json({ ok: true, profile: p });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin(); if (!gate.ok) return gate.res;

  let body: any;
  try { body = ProfileInputSchema.parse(await req.json()); }
  catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }

  const exists = await prisma.userProfile.findUnique({ where: { userId: params.id } });
  const data = {
    businessName: body.businessName,
    businessTypes: body.businessTypes,
    equipmentCount: body.equipmentCount ?? null,
    hasDryAged: body.hasDryAged ?? null,
    supervisorInitials: body.supervisorInitials ?? null,
    equipmentFlags: body.equipmentFlags ?? {},
  };

  const profile = exists
    ? await prisma.userProfile.update({ where: { userId: params.id }, data })
    : await prisma.userProfile.create({ data: { userId: params.id, ...data } });

  return NextResponse.json({ ok: true, profile });
}
