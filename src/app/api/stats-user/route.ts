// src/app/api/stats-user/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth-helpers";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const userId = (me as any).id as string;

    // counts (same connection)
    const [assignedTotal, myUploadsTotal] = await prisma.$transaction([
      prisma.fileAssignment.count({ where: { userId } }),
      prisma.file.count({ where: { uploadedById: userId } }),
    ]);

    // 30-day uploads series (by current user)
    const today = startOfDay(new Date());
    const since = new Date(today);
    since.setDate(today.getDate() - 29);

    const uploads = await prisma.file.findMany({
      where: {
        uploadedById: userId,
        createdAt: { gte: since, lte: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) },
      },
      select: { createdAt: true },
    });

    // bucket by day
    const byDay = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      byDay.set(k, 0);
    }
    for (const f of uploads) {
      const k = startOfDay(new Date(f.createdAt)).toISOString().slice(0, 10);
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) || 0) + 1);
    }
    const series = Array.from(byDay.entries()).map(([x, y]) => ({ x, y }));

    return NextResponse.json({
      assignedTotal,
      myUploadsTotal,
      series,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "stats_user_failed", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
