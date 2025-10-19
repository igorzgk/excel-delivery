// src/app/api/stats/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

export async function GET() {
  // Admin-only stats (adjust if you want user-level stats)
  const guard = await requireRole("ADMIN");
  if (!guard.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: guard.status });
  }

  try {
    // Run all counts on the SAME connection to avoid any pool hop weirdness.
    const [totalUsers, activeUsers, totalFiles, assignedLinks] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.file.count(),
      prisma.fileAssignment.count(),
    ]);

    return NextResponse.json({
      ok: true,
      stats: {
        users: { total: totalUsers, active: activeUsers },
        files: { total: totalFiles },
        assignments: { total: assignedLinks },
        // add more if you like (downloads, audits, etc.)
      },
    });
  } catch (err: any) {
    // Helpful hints if PgBouncer/prepared statements ever crop up again
    const message = err?.message || String(err);
    const hint =
      /26000|42P05/.test(message)
        ? "Check Vercel DATABASE_URL uses the Transaction Pooler and includes '?sslmode=require&pgbouncer=true'."
        : undefined;

    console.error("stats:error", { message, hint });
    return NextResponse.json(
      { ok: false, error: "stats_failed", detail: message, hint },
      { status: 500 }
    );
  }
}
