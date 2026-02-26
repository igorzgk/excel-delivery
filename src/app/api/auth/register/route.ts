// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

const ProfileSchema = z.object({
  businessName: z.string().min(1),
  addressStreet: z.string().trim().max(120).optional().nullable(), // ✅ NEW
  businessTypes: z.array(z.string()).min(1),

  fridgeCount: z.coerce.number().int().min(0).default(0),
  freezerCount: z.coerce.number().int().min(0).default(0),
  hotCabinetCount: z.coerce.number().int().min(0).default(0),
  dryAgedChamberCount: z.coerce.number().int().min(0).default(0),
  iceCreamFreezerCount: z.coerce.number().int().min(0).default(0),

  supervisorInitials: z.string().optional().nullable(),

  closedWeekdays: z.array(z.string()).optional().default([]),
  closedHolidays: z.array(z.string()).optional().default([]),

  augustRange: z
    .object({
      from: z.string().optional().default(""),
      to: z.string().optional().default(""),
    })
    .optional()
    .default({ from: "", to: "" }),
});

const SignupSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Invalid email"),
  password: z.string().min(7, "Password must be at least 7 characters"),
  profile: ProfileSchema,
});

function ymdToDateOrNull(s?: string) {
  const v = (s || "").trim();
  if (!v) return null;
  const d = new Date(v + "T00:00:00.000Z");
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  try {
    if (process.env.ALLOW_SIGNUPS !== "true") {
      return NextResponse.json({ error: "Signups are disabled" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_payload", detail: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, password, profile } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: hash,
          role: "USER",
          subscriptionActive: false,
          status: "PENDING",
        },
        select: { id: true, email: true, name: true, status: true, role: true },
      });

      await tx.userProfile.create({
        data: {
          userId: user.id,
          businessName: profile.businessName,
          addressStreet: profile.addressStreet?.trim() || null, // ✅ NEW
          businessTypes: profile.businessTypes as any,

          fridgeCount: profile.fridgeCount ?? 0,
          freezerCount: profile.freezerCount ?? 0,
          hotCabinetCount: profile.hotCabinetCount ?? 0,
          dryAgedChamberCount: profile.dryAgedChamberCount ?? 0,
          iceCreamFreezerCount: profile.iceCreamFreezerCount ?? 0,

          supervisorInitials: profile.supervisorInitials || null,

          closedWeekdays: (profile.closedWeekdays ?? []) as any,
          closedHolidays: (profile.closedHolidays ?? []) as any,

          augustClosedFrom: ymdToDateOrNull(profile.augustRange?.from),
          augustClosedTo: ymdToDateOrNull(profile.augustRange?.to),
        },
      });

      return user;
    });

    return NextResponse.json({ ok: true, user: result }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}