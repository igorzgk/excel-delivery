import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ProfileInputSchema } from "@/lib/businessProfile";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return { ok: false as const, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin(); if (!gate.ok) return gate.res;
  const p = await prisma.userProfile.findUnique({ where: { userId: params.id } });

  const profile = p && {
    ...p,
    holidayClosedDates: p.holidayClosedDates?.map(d => d.toISOString().slice(0,10)) ?? [],
    augustRange: p.augustClosedFrom && p.augustClosedTo
      ? { from: p.augustClosedFrom.toISOString().slice(0,10), to: p.augustClosedTo.toISOString().slice(0,10) }
      : undefined,
    easterRange: p.easterClosedFrom && p.easterClosedTo
      ? { from: p.easterClosedFrom.toISOString().slice(0,10), to: p.easterClosedTo.toISOString().slice(0,10) }
      : undefined,
  };

  return NextResponse.json({ ok: true, profile });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin(); if (!gate.ok) return gate.res;

  let body = await req.json();
  const parsed = ProfileInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload", detail: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const data = {
    businessName: b.businessName,
    businessTypes: b.businessTypes,
    equipmentCount: b.equipmentCount ?? null,
    hasDryAged: b.hasDryAged ?? null,
    supervisorInitials: b.supervisorInitials ?? null,
    equipmentFlags: b.equipmentFlags ?? {},

    closedDaysText: b.closedDaysText ?? null,
    holidayClosedDates: (b.holidayClosedDates ?? []).map(s => new Date(s)),
    augustClosedFrom: b.augustRange?.from ? new Date(b.augustRange.from) : null,
    augustClosedTo:   b.augustRange?.to   ? new Date(b.augustRange.to)   : null,
    easterClosedFrom: b.easterRange?.from ? new Date(b.easterRange.from) : null,
    easterClosedTo:   b.easterRange?.to   ? new Date(b.easterRange.to)   : null,
  };

  const exists = await prisma.userProfile.findUnique({ where: { userId: params.id } });
  const profile = exists
    ? await prisma.userProfile.update({ where: { userId: params.id }, data })
    : await prisma.userProfile.create({ data: { userId: params.id, ...data } });

  return NextResponse.json({ ok: true, profile });
}
