// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

// Shape of the extra profile data coming from the registration form
const ProfileSchema = z.object({
  businessName: z.string().min(1, "Επωνυμία επιχείρησης είναι υποχρεωτική."),
  businessTypes: z.array(z.string()).min(1, "Επιλέξτε τουλάχιστον ένα είδος επιχείρησης."),

  // αυτά υπάρχουν μόνο στο frontend για τώρα – ΔΕΝ τα γράφουμε στο Prisma
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

    // Έλεγχος αν υπάρχει ήδη χρήστης με αυτό το email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // Δημιουργία χρήστη
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

    // Αν έχει έρθει profile, δημιουργούμε UserProfile
    if (profile) {
      await prisma.userProfile.create({
        data: {
          userId: user.id,
          businessName: profile.businessName,
          // Business types: enum[] (π.χ. "RESTAURANT_GRILL" κλπ)
          businessTypes: profile.businessTypes as any,

          // ΜΟΝΟ αυτό το extra πεδίο υπάρχει στο schema
          supervisorInitials: profile.supervisorInitials || null,

          // Τα παρακάτω υπάρχουν στο schema και τα γεμίζουμε μόνο για Αύγουστο
          augustClosedFrom: parseDateOrNull(profile.augustRange?.from ?? null),
          augustClosedTo: parseDateOrNull(profile.augustRange?.to ?? null),

          // ΔΕΝ περνάμε:
          // - equipmentFlags
          // - hasDryAged
          // - closedDaysText
          // - holidayClosedDates
          // - easterRange
          // ούτε fridge/freezer counts & enums προς το παρόν,
          // οπότε μένουν στα default του schema.
        },
      });
    }

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
