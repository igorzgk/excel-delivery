// src/app/api/stats/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

/**
 * Returns a flat shape to match the AdminDashboard expectations:
 * { users: number, pending: number, files: number }
 */
export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: guard.status });
  }

  try {
    const [totalUsers, activeUsers, totalFiles] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.file.count(),
    ]);

    return NextResponse.json({
      users: totalUsers,
      pending: Math.max(0, totalUsers - activeUsers),
      files: totalFiles,
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    const hint =
      /26000|42P05/.test(message)
        ? "Make sure DATABASE_URL uses the Supabase pooler (6543) and includes '?sslmode=require&pgbouncer=true'."
        : undefined;

    console.error("api/stats error:", { message, hint });
    return NextResponse.json({ error: "stats_failed", detail: message, hint }, { status: 500 });
  }
}
