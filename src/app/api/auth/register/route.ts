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

export async function POST(req: Request) {
  try {
    if (process.env.ALLOW_SIGNUPS !== "true") {
      return NextResponse.json({ error: "Signups are disabled" }, { status: 403 });
    }

    const body = await req.json();

    // 1) Validate account fields only
    const parsedAccount = SignupSchema.safeParse(body);
    if (!parsedAccount.success) {
      return NextResponse.json(
        { error: parsedAccount.error.flatten() },
        { status: 400 }
      );
    }
    const { name, email, password } = parsedAccount.data;

    // 2) Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 }
      );
    }

    // 3) Create user
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

    // 4) Create profile if provided
    const profileRaw = body.profile;
    if (profileRaw && typeof profileRaw === "object") {
      const p = profileRaw as any;

      const businessName = (p.businessName ?? "").toString().trim();
      const businessTypes = Array.isArray(p.businessTypes)
        ? p.businessTypes.map((x: any) => String(x)).filter(Boolean)
        : [];

      // If either is missing, just skip creating profile (client already forces them)
      if (businessName && businessTypes.length > 0) {
        const equipmentCount =
          typeof p.equipmentCount === "number"
            ? p.equipmentCount
            : Number(p.equipmentCount ?? 0) || 0;

        const hasDryAged = !!p.hasDryAged;
        const supervisorInitials =
          typeof p.supervisorInitials === "string"
            ? p.supervisorInitials
            : "";

        const equipmentFlags =
          p.equipmentFlags && typeof p.equipmentFlags === "object"
            ? p.equipmentFlags
            : {};

        const closedDaysText =
          typeof p.closedDaysText === "string" ? p.closedDaysText : "";

        const holidayClosedDates: Date[] = Array.isArray(p.holidayClosedDates)
          ? p.holidayClosedDates
              .filter((d: any) => !!d)
              .map((d: any) => new Date(String(d)))
          : [];

        const augustFromStr = p.augustRange?.from || "";
        const augustToStr = p.augustRange?.to || "";
        const easterFromStr = p.easterRange?.from || "";
        const easterToStr = p.easterRange?.to || "";

        await prisma.userProfile.create({
          data: {
            userId: user.id,
            businessName,
            businessTypes,
            equipmentCount,
            hasDryAged,
            supervisorInitials,
            equipmentFlags,
            closedDaysText,
            holidayClosedDates,
            augustClosedFrom: augustFromStr ? new Date(augustFromStr) : null,
            augustClosedTo: augustToStr ? new Date(augustToStr) : null,
            easterClosedFrom: easterFromStr ? new Date(easterFromStr) : null,
            easterClosedTo: easterToStr ? new Date(easterToStr) : null,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
