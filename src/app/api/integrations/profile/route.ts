import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
  if (!user) return NextResponse.json({ ok: false, exists: false }, { status: 404 });

  const p = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  const profile = p && {
    businessName: p.businessName,
    businessTypes: p.businessTypes,
    equipmentCount: p.equipmentCount,
    hasDryAged: p.hasDryAged,
    supervisorInitials: p.supervisorInitials,
    equipmentFlags: p.equipmentFlags as any,
    closedDaysText: p.closedDaysText,
    holidayClosedDates: p.holidayClosedDates?.map((d) => d.toISOString().slice(0, 10)) ?? [],
    augustRange: p.augustClosedFrom && p.augustClosedTo
      ? { from: p.augustClosedFrom.toISOString().slice(0, 10), to: p.augustClosedTo.toISOString().slice(0, 10) }
      : null,
    easterRange: p.easterClosedFrom && p.easterClosedTo
      ? { from: p.easterClosedFrom.toISOString().slice(0, 10), to: p.easterClosedTo.toISOString().slice(0, 10) }
      : null,
  };

  return NextResponse.json({ ok: true, exists: true, user, profile });
}
