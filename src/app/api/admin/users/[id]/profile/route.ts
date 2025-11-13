// src/app/api/admin/users/[id]/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";

function toDateString(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const userId = params.id;

  const p = await prisma.userProfile.findUnique({ where: { userId } });

  if (!p) {
    return NextResponse.json({ profile: null }, { status: 200 });
  }

  const profile = {
    businessName: p.businessName,
    businessTypes: p.businessTypes,
    equipmentCount: p.equipmentCount,
    hasDryAged: p.hasDryAged,
    supervisorInitials: p.supervisorInitials,
    equipmentFlags: p.equipmentFlags as Record<string, boolean> | null,

    closedDaysText: p.closedDaysText,
    holidayClosedDates: (p.holidayClosedDates || []).map((d) =>
      d.toISOString().slice(0, 10)
    ),
    augustRange:
      p.augustClosedFrom && p.augustClosedTo
        ? {
            from: toDateString(p.augustClosedFrom),
            to: toDateString(p.augustClosedTo),
          }
        : null,
    easterRange:
      p.easterClosedFrom && p.easterClosedTo
        ? {
            from: toDateString(p.easterClosedFrom),
            to: toDateString(p.easterClosedTo),
          }
        : null,
  };

  return NextResponse.json({ profile }, { status: 200 });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const userId = params.id;
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const {
    businessName,
    businessTypes,
    equipmentCount,
    hasDryAged,
    supervisorInitials,
    equipmentFlags,

    closedDaysText,
    holidayClosedDates,
    augustRange,
    easterRange,
  } = body as any;

  const toDateOrNull = (s?: string | null) =>
    s ? new Date(`${s}T00:00:00Z`) : null;

  const updated = await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      businessName: businessName || "",
      businessTypes: businessTypes || [],
      equipmentCount: equipmentCount ?? 0,
      hasDryAged: !!hasDryAged,
      supervisorInitials: supervisorInitials || "",
      equipmentFlags: (equipmentFlags ?? {}) as any,

      closedDaysText: closedDaysText || "",
      holidayClosedDates: (holidayClosedDates || [])
        .map(toDateOrNull)
        .filter(Boolean) as Date[],
      augustClosedFrom: toDateOrNull(augustRange?.from),
      augustClosedTo: toDateOrNull(augustRange?.to),
      easterClosedFrom: toDateOrNull(easterRange?.from),
      easterClosedTo: toDateOrNull(easterRange?.to),
    },
    update: {
      businessName: businessName ?? undefined,
      businessTypes: businessTypes ?? undefined,
      equipmentCount: equipmentCount ?? undefined,
      hasDryAged: hasDryAged ?? undefined,
      supervisorInitials: supervisorInitials ?? undefined,
      equipmentFlags: (equipmentFlags ?? undefined) as any,

      closedDaysText: closedDaysText ?? undefined,
      holidayClosedDates: holidayClosedDates
        ? (holidayClosedDates || [])
            .map(toDateOrNull)
            .filter(Boolean) as Date[]
        : undefined,
      augustClosedFrom: augustRange ? toDateOrNull(augustRange.from) : undefined,
      augustClosedTo: augustRange ? toDateOrNull(augustRange.to) : undefined,
      easterClosedFrom: easterRange ? toDateOrNull(easterRange.from) : undefined,
      easterClosedTo: easterRange ? toDateOrNull(easterRange.to) : undefined,
    },
    select: { userId: true },
  });

  return NextResponse.json({ ok: true, userId: updated.userId }, { status: 200 });
}
