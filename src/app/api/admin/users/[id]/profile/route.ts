// src/app/api/admin/users/[id]/profile/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const AugustRangeSchema = z
  .object({
    from: z.string().optional().nullable(),
    to: z.string().optional().nullable(),
  })
  .optional()
  .nullable()
  .transform((val) => {
    if (!val) return null;

    const from = (val.from ?? "").trim();
    const to = (val.to ?? "").trim();

    // empty inputs => null
    if (!from || !to) return null;

    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return null;

    return { from, to };
  });

const ProfileSchema = z.object({
  // ✅ keep required DB fields safe with defaults
  businessName: z.string().trim().optional().default(""),
  businessTypes: z.array(z.string()).optional().default([]),
  addressStreet: z.string().max(120).optional().nullable(),

  fridgeCount: z.number().int().nonnegative().optional().default(0),
  freezerCount: z.number().int().nonnegative().optional().default(0),
  hotCabinetCount: z.number().int().nonnegative().optional().default(0),
  dryAgedChamberCount: z.number().int().nonnegative().optional().default(0),
  iceCreamFreezerCount: z.number().int().nonnegative().optional().default(0),

  supervisorInitials: z.string().max(20).optional().nullable().default(null),

  closedWeekdays: z.array(z.string()).optional().default([]),
  closedHolidays: z.array(z.string()).optional().default([]),

  augustRange: AugustRangeSchema,
});

function toISODate(d: Date | null | undefined) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
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
            businessName: p.businessName ?? "",
            businessTypes: p.businessTypes ?? [],
            addressStreet: p.addressStreet ?? null,
            fridgeCount: p.fridgeCount ?? 0,
            freezerCount: p.freezerCount ?? 0,
            hotCabinetCount: p.hotCabinetCount ?? 0,
            dryAgedChamberCount: p.dryAgedChamberCount ?? 0,
            iceCreamFreezerCount: p.iceCreamFreezerCount ?? 0,
            supervisorInitials: p.supervisorInitials ?? null,
            closedWeekdays: p.closedWeekdays ?? [],
            closedHolidays: p.closedHolidays ?? [],
            augustRange:
              p.augustClosedFrom && p.augustClosedTo
                ? { from: toISODate(p.augustClosedFrom), to: toISODate(p.augustClosedTo) }
                : null,
          }
        : null,
    },
    { status: 200 }
  );
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const userId = ctx.params.id;

  const body = await req.json().catch(() => ({}));
  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const data = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const augustFrom = data.augustRange?.from ? new Date(data.augustRange.from + "T00:00:00Z") : null;
  const augustTo = data.augustRange?.to ? new Date(data.augustRange.to + "T00:00:00Z") : null;

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,

      // ✅ DB requires these
      businessName: data.businessName || "",
      businessTypes: (data.businessTypes ?? []) as any,
      addressStreet: data.addressStreet ?? null,

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
      businessName: data.businessName || "",
      businessTypes: (data.businessTypes ?? []) as any,
      addressStreet: data.addressStreet ?? null,

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