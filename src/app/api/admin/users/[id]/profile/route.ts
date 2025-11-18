// src/app/api/admin/users/[id]/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ProfileSchema = z.object({
  businessName: z.string().min(1),
  businessTypes: z.array(z.string()).default([]),

  equipmentCount: z.number().int().nullable().optional(),
  hasDryAged: z.boolean().nullable().optional(),
  supervisorInitials: z.string().max(20).nullable().optional(),
  equipmentFlags: z.record(z.boolean()).nullable().optional(),

  closedDaysText: z.string().nullable().optional(),

  // dates as ISO strings ("YYYY-MM-DD")
  holidayClosedDates: z.array(z.string()).optional(),
  augustFrom: z.string().nullable().optional(),
  augustTo: z.string().nullable().optional(),
  easterFrom: z.string().nullable().optional(),
  easterTo: z.string().nullable().optional(),
});

function serializeProfile(p: any) {
  return {
    businessName: p.businessName,
    businessTypes: p.businessTypes ?? [],
    equipmentCount: p.equipmentCount ?? null,
    hasDryAged: p.hasDryAged ?? null,
    supervisorInitials: p.supervisorInitials ?? "",
    equipmentFlags: (p.equipmentFlags as Record<string, boolean> | null) ?? {},

    closedDaysText: p.closedDaysText ?? "",

    holidayClosedDates: (p.holidayClosedDates ?? []).map((d: Date) =>
      d.toISOString().slice(0, 10)
    ),

    augustFrom: p.augustClosedFrom
      ? p.augustClosedFrom.toISOString().slice(0, 10)
      : null,
    augustTo: p.augustClosedTo
      ? p.augustClosedTo.toISOString().slice(0, 10)
      : null,
    easterFrom: p.easterClosedFrom
      ? p.easterClosedFrom.toISOString().slice(0, 10)
      : null,
    easterTo: p.easterClosedTo
      ? p.easterClosedTo.toISOString().slice(0, 10)
      : null,
  };
}

// ---------- GET: Admin loads another user's profile ----------
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
    include: { profile: true }, // assumes `profile UserProfile?` on User
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

// ---------- PUT: Admin updates another user's profile ----------
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyJson = await req.json();
  const parsed = ProfileSchema.safeParse(bodyJson);

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

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      businessName: data.businessName,
      businessTypes: data.businessTypes,
      equipmentCount: data.equipmentCount ?? null,
      hasDryAged: data.hasDryAged ?? null,
      supervisorInitials: data.supervisorInitials ?? null,
      equipmentFlags: data.equipmentFlags ?? null,
      closedDaysText: data.closedDaysText ?? null,
      holidayClosedDates: (data.holidayClosedDates ?? []).map(
        (d) => new Date(d)
      ),
      augustClosedFrom: data.augustFrom ? new Date(data.augustFrom) : null,
      augustClosedTo: data.augustTo ? new Date(data.augustTo) : null,
      easterClosedFrom: data.easterFrom ? new Date(data.easterFrom) : null,
      easterClosedTo: data.easterTo ? new Date(data.easterTo) : null,
    },
    update: {
      businessName: data.businessName,
      businessTypes: data.businessTypes,
      equipmentCount: data.equipmentCount ?? null,
      hasDryAged: data.hasDryAged ?? null,
      supervisorInitials: data.supervisorInitials ?? null,
      equipmentFlags: data.equipmentFlags ?? null,
      closedDaysText: data.closedDaysText ?? null,
      holidayClosedDates: (data.holidayClosedDates ?? []).map(
        (d) => new Date(d)
      ),
      augustClosedFrom: data.augustFrom ? new Date(data.augustFrom) : null,
      augustClosedTo: data.augustTo ? new Date(data.augustTo) : null,
      easterClosedFrom: data.easterFrom ? new Date(data.easterFrom) : null,
      easterClosedTo: data.easterTo ? new Date(data.easterTo) : null,
    },
  });

  return NextResponse.json({ ok: true, profile: serializeProfile(profile) });
}
