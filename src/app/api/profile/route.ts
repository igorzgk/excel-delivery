// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";

// Helper for YYYY-MM-DD
function toDateString(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : null;
}

// Turn "2025-12-11" into Date | null
function toDateOrNull(s?: string | null) {
  return s ? new Date(`${s}T00:00:00Z`) : null;
}

/**
 * GET /api/profile
 * - returns current user basic info + full profile (including dates)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, status: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const p = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });

  if (!p) {
    return NextResponse.json(
      {
        ok: true,
        user,
        profile: null,
      },
      { status: 200 }
    );
  }

  const profile = {
    businessName: p.businessName,
    businessTypes: p.businessTypes,
    equipmentCount: p.equipmentCount,
    hasDryAged: p.hasDryAged,
    supervisorInitials: p.supervisorInitials,
    equipmentFlags: (p.equipmentFlags || {}) as Record<string, boolean>,

    closedDaysText: p.closedDaysText,
    holidayClosedDates: (p.holidayClosedDates || []).map((d) =>
      toDateString(d)
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

  return NextResponse.json(
    {
      ok: true,
      user,
      profile,
    },
    { status: 200 }
  );
}

/**
 * PUT /api/profile
 * - body: all profile properties (the same shape your integration GET returns)
 * - saves/updates profile for the current user
 */
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

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

  const holidayDates: Date[] = (holidayClosedDates || [])
    .map((s: string) => toDateOrNull(s))
    .filter(Boolean) as Date[];

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      businessName: businessName || "",
      businessTypes: businessTypes || [],
      equipmentCount: equipmentCount ?? 0,
      hasDryAged: !!hasDryAged,
      supervisorInitials: supervisorInitials || "",
      equipmentFlags: (equipmentFlags || {}) as any,

      closedDaysText: closedDaysText || "",
      holidayClosedDates: holidayDates,
      augustClosedFrom: augustRange ? toDateOrNull(augustRange.from) : null,
      augustClosedTo: augustRange ? toDateOrNull(augustRange.to) : null,
      easterClosedFrom: easterRange ? toDateOrNull(easterRange.from) : null,
      easterClosedTo: easterRange ? toDateOrNull(easterRange.to) : null,
    },
    update: {
      businessName: businessName ?? undefined,
      businessTypes: businessTypes ?? undefined,
      equipmentCount: equipmentCount ?? undefined,
      hasDryAged: hasDryAged ?? undefined,
      supervisorInitials: supervisorInitials ?? undefined,
      equipmentFlags: equipmentFlags ?? undefined,

      closedDaysText: closedDaysText ?? undefined,
      holidayClosedDates: holidayClosedDates
        ? holidayDates
        : undefined,
      augustClosedFrom: augustRange
        ? toDateOrNull(augustRange.from)
        : undefined,
      augustClosedTo: augustRange
        ? toDateOrNull(augustRange.to)
        : undefined,
      easterClosedFrom: easterRange
        ? toDateOrNull(easterRange.from)
        : undefined,
      easterClosedTo: easterRange
        ? toDateOrNull(easterRange.to)
        : undefined,
    },
  });

  return NextResponse.json(
    { ok: true, userId: profile.userId },
    { status: 200 }
  );
}
