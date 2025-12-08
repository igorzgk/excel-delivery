// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

const ProfileSchema = z.object({
  businessName: z.string().min(1, "Επωνυμία επιχείρησης είναι υποχρεωτική."),
  businessTypes: z.array(z.string()).min(1, "Επιλέξτε τουλάχιστον ένα είδος επιχείρησης."),
  hasDryAged: z.boolean().optional(),
  supervisorInitials: z.string().optional(),
  equipmentFlags: z.record(z.boolean()).optional(),

  closedDaysText: z.string().optional(),
  holidayClosedDates: z.array(z.string()).optional(), // "YYYY-MM-DD"[]

  augustRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  easterRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
});

const SignupSchema = z.object({
  name: z.string().min(2, "Το όνομα είναι πολύ σύντομο."),
  email: z.string().email("Μη έγκυρο email."),
  password: z.string().min(6, "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες."),
  profile: ProfileSchema.optional(),
});

function parseDateOrNull(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(req: Request) {
  try {
    if (process.env.ALLOW_SIGNUPS !== "true") {
      return NextResponse.json({ error: "Signups are disabled" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = SignupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { name, email, password, profile } = parsed.data;

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // Hash password and create user
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

    // If profile data is provided, create UserProfile
    if (profile) {
      const holidayDates: Date[] = (profile.holidayClosedDates ?? [])
        .map((d) => parseDateOrNull(d))
        .filter((d): d is Date => d !== null);

      await prisma.userProfile.create({
        data: {
          userId: user.id,
          businessName: profile.businessName,
          // Prisma enum[] expects *enum values*; here we trust the frontend
          // is already sending the enum keys like "RESTAURANT_GRILL"
          businessTypes: profile.businessTypes as any,

          hasDryAged: profile.hasDryAged ?? false,
          supervisorInitials: profile.supervisorInitials || null,
          equipmentFlags: profile.equipmentFlags ?? {},

          closedDaysText: profile.closedDaysText || null,
          holidayClosedDates: holidayDates,

          augustClosedFrom: parseDateOrNull(profile.augustRange?.from ?? null),
          augustClosedTo: parseDateOrNull(profile.augustRange?.to ?? null),
          easterClosedFrom: parseDateOrNull(profile.easterRange?.from ?? null),
          easterClosedTo: parseDateOrNull(profile.easterRange?.to ?? null),

          // ⚠️ IMPORTANT:
          // We DO NOT send `equipmentCount` here anymore because your Prisma
          // schema does not have that field. The new optional numeric
          // fields (fridgeCount, freezerCount, etc.) will just stay null
          // until we wire them from the new registration form.
        },
      });
    }

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
