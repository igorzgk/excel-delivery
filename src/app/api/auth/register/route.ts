// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";
import { ProfileInputSchema } from "@/lib/businessProfile"; // <-- import the schema for validation

// Basic signup schema
const SignupSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  profile: ProfileInputSchema.optional(), // optional profile data
});

export async function POST(req: Request) {
  try {
    if (process.env.ALLOW_SIGNUPS !== "true") {
      return NextResponse.json({ error: "Signups are disabled" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, password, profile } = parsed.data;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Create user
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

    // Create profile if provided
    if (profile) {
      await prisma.userProfile.create({
        data: {
          userId: user.id,
          businessName: profile.businessName,
          businessTypes: profile.businessTypes,
          equipmentCount: profile.equipmentCount ?? null,
          hasDryAged: profile.hasDryAged ?? null,
          supervisorInitials: profile.supervisorInitials ?? null,
          equipmentFlags: profile.equipmentFlags ?? {},
        },
      });
    }

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
