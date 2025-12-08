// src/app/api/integrations/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";

// Helper: convert Date -> "YYYY-MM-DD"
function toISODate(d: Date | null | undefined) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      role: true,
      profile: true,
    },
  });

  if (!user) {
    return NextResponse.json({ ok: true, exists: false }, { status: 200 });
  }

  const p = user.profile;

  return NextResponse.json(
    {
      ok: true,
      exists: true,
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
            businessTypes: p.businessTypes, // enum string[]

            fridgeCount: p.fridgeCount,
            freezerCount: p.freezerCount,
            hotCabinetCount: p.hotCabinetCount,
            dryAgedChamberCount: p.dryAgedChamberCount,
            iceCreamFreezerCount: p.iceCreamFreezerCount,

            supervisorInitials: p.supervisorInitials,

            closedWeekdays: p.closedWeekdays,   // Weekday[]
            closedHolidays: p.closedHolidays,   // PublicHoliday[]

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
