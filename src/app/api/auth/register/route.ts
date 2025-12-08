// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

// --------- BASE ACCOUNT SCHEMA ----------
const SignupSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  // profile comes from the registration step 2
  profile: z.any().optional(),
});

// --------- BUSINESS PROFILE SCHEMA (NEW FIELDS) ----------
// We *don’t* hard-enforce enum values here; we accept string[]
// and rely on the frontend to send valid enum values that Prisma accepts.
const ProfileSchema = z.object({
  businessName: z.string().min(1, "Επωνυμία επιχείρησης είναι υποχρεωτική"),
  businessTypes: z.array(z.string()).min(1, "Επιλέξτε τουλάχιστον ένα είδος επιχείρησης"),

  // Εξοπλισμός αποθήκευσης/διατήρησης τροφίμων
  fridgeCount: z.number().int().nonnegative().optional().default(0),
  freezerCount: z.number().int().nonnegative().optional().default(0),
  hotCabinetCount: z.number().int().nonnegative().optional().default(0),
  dryAgedChamberCount: z.number().int().nonnegative().optional().default(0),
  iceCreamFreezerCount: z.number().int().nonnegative().optional().default(0),

  // Αρχικά υπευθύνου
  supervisorInitials: z.string().max(20).optional().nullable(),

  // Μέρες εβδομάδας (enum strings MONDAY...SUNDAY)
  closedWeekdays: z.array(z.string()).optional().default([]),

  // Αργίες (enum strings NEW_YEAR, CLEAN_MONDAY, etc.)
  closedHolidays: z.array(z.string()).optional().default([]),

  // Διάστημα Αυγούστου (YYYY-MM-DD strings)
  augustRange: z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional()
    .nullable(),
}).partial({
  fridgeCount: true,
  freezerCount: true,
  hotCabinetCount: true,
  dryAgedChamberCount: true,
  iceCreamFreezerCount: true,
  supervisorInitials: true,
  closedWeekdays: true,
  closedHolidays: true,
  augustRange: true,
});

export async function POST(req: Request) {
  try {
    if (process.env.ALLOW_SIGNUPS !== "true") {
      return NextResponse.json({ error: "Signups are disabled" }, { status: 403 });
    }

    const raw = await req.json();
    const parsed = SignupSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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

    // ---------- OPTIONAL: CREATE BUSINESS PROFILE ----------
    if (profile) {
      let prof;
      try {
        prof = ProfileSchema.parse(profile);
      } catch (e) {
        console.error("Profile validation error:", e);
        return NextResponse.json({ error: "invalid_profile_payload" }, { status: 400 });
      }

      const augustFrom =
        prof.augustRange?.from ? new Date(prof.augustRange.from + "T00:00:00Z") : null;
      const augustTo =
        prof.augustRange?.to ? new Date(prof.augustRange.to + "T00:00:00Z") : null;

      await prisma.userProfile.create({
        data: {
          userId: user.id,
          businessName: prof.businessName,
          businessTypes: prof.businessTypes as any, // must match Prisma enum names
          fridgeCount: prof.fridgeCount ?? 0,
          freezerCount: prof.freezerCount ?? 0,
          hotCabinetCount: prof.hotCabinetCount ?? 0,
          dryAgedChamberCount: prof.dryAgedChamberCount ?? 0,
          iceCreamFreezerCount: prof.iceCreamFreezerCount ?? 0,
          supervisorInitials: prof.supervisorInitials ?? null,
          closedWeekdays: (prof.closedWeekdays ?? []) as any,
          closedHolidays: (prof.closedHolidays ?? []) as any,
          augustClosedFrom: augustFrom,
          augustClosedTo: augustTo,
        },
      });
    }

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
