// src/app/api/admin/users/[id]/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function serializeProfile(p: any) {
  const toISO = (d?: Date | null) =>
    d ? d.toISOString().slice(0, 10) : "";

  return {
    businessName: p.businessName,
    businessTypes: p.businessTypes ?? [],
    equipmentCount: p.equipmentCount ?? 0,
    hasDryAged: !!p.hasDryAged,
    supervisorInitials: p.supervisorInitials ?? "",
    equipmentFlags: (p.equipmentFlags as Record<string, boolean> | null) ?? {},

    closedDaysText: p.closedDaysText ?? "",
    holidayClosedDates: (p.holidayClosedDates ?? []).map((d: Date) =>
      d.toISOString().slice(0, 10)
    ),

    augustRange: {
      from: toISO(p.augustClosedFrom),
      to: toISO(p.augustClosedTo),
    },
    easterRange: {
      from: toISO(p.easterClosedFrom),
      to: toISO(p.easterClosedTo),
    },
  };
}

// ---------- GET: admin views user profile ----------
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: { profile: true },
  });

  if (!user) {
    return NextResponse.json({ ok: false, exists: false }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    exists: !!user.profile,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      role: user.role,
    },
    profile: user.profile ? serializeProfile(user.profile) : null,
  });
}

// ---------- PUT: admin updates user profile ----------
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const p = body as any;

  const businessName = (p.businessName ?? "").toString().trim();
  const businessTypes = Array.isArray(p.businessTypes)
    ? p.businessTypes.map((x: any) => String(x)).filter(Boolean)
    : [];

  if (!businessName) {
    return NextResponse.json(
      { error: "business_name_required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const equipmentCount =
    typeof p.equipmentCount === "number"
      ? p.equipmentCount
      : Number(p.equipmentCount ?? 0) || 0;

  const hasDryAged = !!p.hasDryAged;
  const supervisorInitials =
    typeof p.supervisorInitials === "string" ? p.supervisorInitials : "";

  const equipmentFlags =
    p.equipmentFlags && typeof p.equipmentFlags === "object"
      ? p.equipmentFlags
      : {};

  const closedDaysText =
    typeof p.closedDaysText === "string" ? p.closedDaysText : "";

  const holidayClosedDates: Date[] = Array.isArray(p.holidayClosedDates)
    ? p.holidayClosedDates
        .filter((d: any) => !!d)
        .map((d: any) => new Date(String(d)))
    : [];

  const augustFromStr = p.augustRange?.from || "";
  const augustToStr = p.augustRange?.to || "";
  const easterFromStr = p.easterRange?.from || "";
  const easterToStr = p.easterRange?.to || "";

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      businessName,
      businessTypes,
      equipmentCount,
      hasDryAged,
      supervisorInitials,
      equipmentFlags,
      closedDaysText,
      holidayClosedDates,
      augustClosedFrom: augustFromStr ? new Date(augustFromStr) : null,
      augustClosedTo: augustToStr ? new Date(augustToStr) : null,
      easterClosedFrom: easterFromStr ? new Date(easterFromStr) : null,
      easterClosedTo: easterToStr ? new Date(easterToStr) : null,
    },
    update: {
      businessName,
      businessTypes,
      equipmentCount,
      hasDryAged,
      supervisorInitials,
      equipmentFlags,
      closedDaysText,
      holidayClosedDates,
      augustClosedFrom: augustFromStr ? new Date(augustFromStr) : null,
      augustClosedTo: augustToStr ? new Date(augustToStr) : null,
      easterClosedFrom: easterFromStr ? new Date(easterFromStr) : null,
      easterClosedTo: easterToStr ? new Date(easterToStr) : null,
    },
  });

  return NextResponse.json({ ok: true, profile: serializeProfile(profile) });
}
