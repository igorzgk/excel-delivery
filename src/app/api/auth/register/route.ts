// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

const SignupSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// This must match your ProfilePayload in register/page.tsx
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

export async function POST(req: Request) {
  try {
    if (process.env.ALLOW_SIGNUPS !== "true") {
      return NextResponse.json({ error: "Signups are disabled" }, { status: 403 });
    }

    const body = await req.json();

    // 1) Validate account fields
    const parsedAccount = SignupSchema.safeParse(body);
    if (!parsedAccount.success) {
      return NextResponse.json(
        { error: parsedAccount.error.flatten() },
        { status: 400 }
      );
    }
    const { name, email, password } = parsedAccount.data;

    // 2) Validate profile (if provided)
    let profileData: z.infer<typeof ProfileSchema> | null = null;
    if (body.profile) {
      const parsedProfile = ProfileSchema.safeParse(body.profile);
      if (!parsedProfile.success) {
        return NextResponse.json(
          { error: "invalid_payload", detail: parsedProfile.error.flatten() },
          { status: 400 }
        );
      }
      profileData = parsedProfile.data;
    }

    // 3) Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 }
      );
    }

    // 4) Create user
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hash,
        role: "USER",
        subscriptionActive: false,
        status: "PENDING",
      },
      select: { id: true, email: true, name: true },
    });

    // 5) Create profile (if data provided)
    if (profileData) {
      const p = profileData;

      const augustFrom = p.augustRange?.from || "";
      const augustTo = p.augustRange?.to || "";
      const easterFrom = p.easterRange?.from || "";
      const easterTo = p.easterRange?.to || "";

      await prisma.userProfile.create({
        data: {
          userId: user.id,
          businessName: p.businessName,
          businessTypes: p.businessTypes ?? [],

          equipmentCount: p.equipmentCount ?? 0,
          hasDryAged: p.hasDryAged ?? false,
          supervisorInitials: p.supervisorInitials ?? null,
          equipmentFlags: p.equipmentFlags ?? {},

          closedDaysText: p.closedDaysText ?? "",
          holidayClosedDates: (p.holidayClosedDates ?? []).map(
            (d) => new Date(d)
          ),

          augustClosedFrom: augustFrom ? new Date(augustFrom) : null,
          augustClosedTo: augustTo ? new Date(augustTo) : null,
          easterClosedFrom: easterFrom ? new Date(easterFrom) : null,
          easterClosedTo: easterTo ? new Date(easterTo) : null,
        },
      });
    }

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
