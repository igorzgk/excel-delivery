// src/app/api/admin/users/[id]/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// This matches your ProfilePayload on the frontend
const ProfileSchema = z.object({
  businessName: z.string().min(1),
  businessTypes: z.array(z.string()).default([]),

  equipmentCount: z.number().int().nullable().optional(),
  hasDryAged: z.boolean().nullable().optional(),
  supervisorInitials: z.string().max(50).nullable().optional(),
  equipmentFlags: z.record(z.boolean()).nullable().optional(),

  closedDaysText: z.string().nullable().optional(),
  holidayClosedDates: z.array(z.string()).optional(), // "YYYY-MM-DD"[]

  augustRange: z
    .object({
      from: z.string().nullable().optional(),
      to: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  easterRange: z
    .object({
      from: z.string().nullable().optional(),
      to: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

// Helper to shape profile → front-end format (same as user /profile)
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

  const json = await req.json();
  const parsed = ProfileSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const augustFrom = data.augustRange?.from || "";
  const augustTo = data.augustRange?.to || "";
  const easterFrom = data.easterRange?.from || "";
  const easterTo = data.easterRange?.to || "";

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      businessName: data.businessName,
      businessTypes: data.businessTypes ?? [],

      equipmentCount: data.equipmentCount ?? 0,
      hasDryAged: data.hasDryAged ?? false,
      supervisorInitials: data.supervisorInitials ?? null,
      equipmentFlags: data.equipmentFlags ?? {},

      closedDaysText: data.closedDaysText ?? "",
      holidayClosedDates: (data.holidayClosedDates ?? []).map(
        (d) => new Date(d)
      ),

      augustClosedFrom: augustFrom ? new Date(augustFrom) : null,
      augustClosedTo: augustTo ? new Date(augustTo) : null,
      easterClosedFrom: easterFrom ? new Date(easterFrom) : null,
      easterClosedTo: easterTo ? new Date(easterTo) : null,
    },
    update: {
      businessName: data.businessName,
      businessTypes: data.businessTypes ?? [],

      equipmentCount: data.equipmentCount ?? 0,
      hasDryAged: data.hasDryAged ?? false,
      supervisorInitials: data.supervisorInitials ?? null,
      equipmentFlags: data.equipmentFlags ?? {},

      closedDaysText: data.closedDaysText ?? "",
      holidayClosedDates: (data.holidayClosedDates ?? []).map(
        (d) => new Date(d)
      ),

      augustClosedFrom: augustFrom ? new Date(augustFrom) : null,
      augustClosedTo: augustTo ? new Date(augustTo) : null,
      easterClosedFrom: easterFrom ? new Date(easterFrom) : null,
      easterClosedTo: easterTo ? new Date(easterTo) : null,
    },
  });

  return NextResponse.json({ ok: true, profile: serializeProfile(profile) });
}
