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

  // convert Date objects -> YYYY-MM-DD for the UI
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

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  const exists = await prisma.userProfile.findUnique({ where: { userId: session.user.id } });
  const profile = exists
    ? await prisma.userProfile.update({ where: { userId: session.user.id }, data })
    : await prisma.userProfile.create({ data: { userId: session.user.id, ...data } });

  return NextResponse.json({ ok: true, profile: { ...profile } });
}
