// src/app/api/integrations/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";

export const runtime = "nodejs";

// Helper for YYYY-MM-DD
function toDateString(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function GET(req: Request) {
  // 1) API key auth
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "missing_email" },
      { status: 400 }
    );
  }

  // 2) Load user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ ok: true, exists: false }, { status: 200 });
  }

  // 3) Load profile (if exists)
  const p = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });

  if (!p) {
    // User exists, but no profile yet
    return NextResponse.json(
      {
        ok: true,
        exists: true,
        user,
        profile: null,
      },
      { status: 200 }
    );
  }

  // 4) Map DB → JSON for client (convert Dates to strings)
  const profile = {
    businessName: p.businessName,
    businessTypes: p.businessTypes,
    equipmentCount: p.equipmentCount,
    hasDryAged: p.hasDryAged,
    supervisorInitials: p.supervisorInitials,
    equipmentFlags: p.equipmentFlags as Record<string, boolean> | null,

    closedDaysText: p.closedDaysText,
    holidayClosedDates: (p.holidayClosedDates || []).map((d) =>
      d.toISOString().slice(0, 10)
    ),
    augustRange:
      p.augustClosedFrom && p.augustClosedTo
        ? {
            from: toDateString(p.augustClosedFrom),
            to: toDateString(p.augustClosedTo),
          }
        : null,
    easterRange:
      p.easterClosedFrom && p.easterClosedTo
        ? {
            from: toDateString(p.easterClosedFrom),
            to: toDateString(p.easterClosedTo),
          }
        : null,
  };

  return NextResponse.json(
    {
      ok: true,
      exists: true,
      user,
      profile,
    },
    { status: 200 }
  );
}
