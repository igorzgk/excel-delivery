// src/app/api/admin/users/[id]/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ProfileSchema = z.object({
  businessName: z.string().min(1),
  businessTypes: z.array(z.string()).min(1),

  fridgeCount: z.number().int().nonnegative().optional().default(0),
  freezerCount: z.number().int().nonnegative().optional().default(0),
  hotCabinetCount: z.number().int().nonnegative().optional().default(0),
  dryAgedChamberCount: z.number().int().nonnegative().optional().default(0),
  iceCreamFreezerCount: z.number().int().nonnegative().optional().default(0),

  supervisorInitials: z.string().max(20).optional().nullable(),

  closedWeekdays: z.array(z.string()).optional().default([]),
  closedHolidays: z.array(z.string()).optional().default([]),

  augustRange: z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional()
    .nullable(),
});

function toISODate(d: Date | null | undefined) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function GET(
  req: Request,
  ctx: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const userId = ctx.params.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      role: true,
      profile: true,
    },
  });

  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const p = user.profile;

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        role: user.role,
      },
      profile: p
        ? {
            businessName: p.businessName,
            businessTypes: p.businessTypes,
            fridgeCount: p.fridgeCount,
            freezerCount: p.freezerCount,
            hotCabinetCount: p.hotCabinetCount,
            dryAgedChamberCount: p.dryAgedChamberCount,
            iceCreamFreezerCount: p.iceCreamFreezerCount,
            supervisorInitials: p.supervisorInitials,
            closedWeekdays: p.closedWeekdays,
            closedHolidays: p.closedHolidays,
            augustRange:
              p.augustClosedFrom && p.augustClosedTo
                ? {
                    from: toISODate(p.augustClosedFrom),
                    to: toISODate(p.augustClosedTo),
                  }
                : null,
          }
        : null,
    },
    { status: 200 }
  );
}

export async function PUT(
  req: Request,
  ctx: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const userId = ctx.params.id;
  const body = await req.json();
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const data = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const augustFrom =
    data.augustRange?.from ? new Date(data.augustRange.from + "T00:00:00Z") : null;
  const augustTo =
    data.augustRange?.to ? new Date(data.augustRange.to + "T00:00:00Z") : null;

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      businessName: data.businessName,
      businessTypes: data.businessTypes as any,
      fridgeCount: data.fridgeCount ?? 0,
      freezerCount: data.freezerCount ?? 0,
      hotCabinetCount: data.hotCabinetCount ?? 0,
      dryAgedChamberCount: data.dryAgedChamberCount ?? 0,
      iceCreamFreezerCount: data.iceCreamFreezerCount ?? 0,
      supervisorInitials: data.supervisorInitials ?? null,
      closedWeekdays: (data.closedWeekdays ?? []) as any,
      closedHolidays: (data.closedHolidays ?? []) as any,
      augustClosedFrom: augustFrom,
      augustClosedTo: augustTo,
    },
    update: {
      businessName: data.businessName,
      businessTypes: data.businessTypes as any,
      fridgeCount: data.fridgeCount ?? 0,
      freezerCount: data.freezerCount ?? 0,
      hotCabinetCount: data.hotCabinetCount ?? 0,
      dryAgedChamberCount: data.dryAgedChamberCount ?? 0,
      iceCreamFreezerCount: data.iceCreamFreezerCount ?? 0,
      supervisorInitials: data.supervisorInitials ?? null,
      closedWeekdays: (data.closedWeekdays ?? []) as any,
      closedHolidays: (data.closedHolidays ?? []) as any,
      augustClosedFrom: augustFrom,
      augustClosedTo: augustTo,
    },
  });

  return NextResponse.json({ ok: true, profile }, { status: 200 });
}
