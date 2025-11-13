import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

const Body = z.object({
  businessName: z.string().min(1).optional(),
  businessTypes: z.array(z.string()).optional(),
  equipmentCount: z.number().int().min(0).nullable().optional(),
  hasDryAged: z.boolean().nullable().optional(),
  supervisorInitials: z.string().nullable().optional(),
  equipmentFlags: z.record(z.boolean()).optional(),

  closedDaysText: z.string().nullable().optional(),
  holidayClosedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  augustRange: z.object({ from: z.string(), to: z.string() }).nullable().optional(),
  easterRange: z.object({ from: z.string(), to: z.string() }).nullable().optional(),
});

function asDateOrNull(s?: string | null) {
  return s ? new Date(`${s}T00:00:00Z`) : null;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const userId = params.id;
  const p = await prisma.userProfile.findUnique({ where: { userId } });

  const profile = p && {
    businessName: p.businessName,
    businessTypes: p.businessTypes,
    equipmentCount: p.equipmentCount,
    hasDryAged: p.hasDryAged,
    supervisorInitials: p.supervisorInitials,
    equipmentFlags: p.equipmentFlags as any,
    closedDaysText: p.closedDaysText,
    holidayClosedDates: (p.holidayClosedDates || []).map(d => d.toISOString().slice(0,10)),
    augustRange: p.augustClosedFrom && p.augustClosedTo
      ? { from: p.augustClosedFrom.toISOString().slice(0,10), to: p.augustClosedTo.toISOString().slice(0,10) }
      : null,
    easterRange: p.easterClosedFrom && p.easterClosedTo
      ? { from: p.easterClosedFrom.toISOString().slice(0,10), to: p.easterClosedTo.toISOString().slice(0,10) }
      : null,
  };

  return NextResponse.json({ profile });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const userId = params.id;
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const data = parsed.data;

  // Upsert
  const updated = await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      businessName: data.businessName || "",
      businessTypes: data.businessTypes || [],
      equipmentCount: data.equipmentCount ?? 0,
      hasDryAged: !!data.hasDryAged,
      supervisorInitials: data.supervisorInitials || "",
      equipmentFlags: (data.equipmentFlags ?? {}) as any,

      closedDaysText: data.closedDaysText || "",
      holidayClosedDates: (data.holidayClosedDates || []).map(asDateOrNull).filter(Boolean) as Date[],
      augustClosedFrom: asDateOrNull(data.augustRange?.from),
      augustClosedTo: asDateOrNull(data.augustRange?.to),
      easterClosedFrom: asDateOrNull(data.easterRange?.from),
      easterClosedTo: asDateOrNull(data.easterRange?.to),
    },
    update: {
      businessName: data.businessName ?? undefined,
      businessTypes: data.businessTypes ?? undefined,
      equipmentCount: data.equipmentCount ?? undefined,
      hasDryAged: data.hasDryAged ?? undefined,
      supervisorInitials: data.supervisorInitials ?? undefined,
      equipmentFlags: (data.equipmentFlags ?? undefined) as any,

      closedDaysText: data.closedDaysText ?? undefined,
      holidayClosedDates: data.holidayClosedDates
        ? data.holidayClosedDates.map(asDateOrNull).filter(Boolean) as Date[]
        : undefined,
      augustClosedFrom: data.augustRange ? asDateOrNull(data.augustRange.from) : undefined,
      augustClosedTo: data.augustRange ? asDateOrNull(data.augustRange.to) : undefined,
      easterClosedFrom: data.easterRange ? asDateOrNull(data.easterRange.from) : undefined,
      easterClosedTo: data.easterRange ? asDateOrNull(data.easterRange.to) : undefined,
    },
    select: { userId: true },
  });

  return NextResponse.json({ ok: true, userId: updated.userId });
}
