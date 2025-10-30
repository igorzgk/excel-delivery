// src/app/api/integrations/users/route.ts
// src/app/api/integrations/users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";

export const runtime = "nodejs";

/**GET /api/integrations/usersHeaders:  x-api-key: YOUR_PLAIN_KEY*
 * Modes:
 *  1) Lookup by email:
 *     /api/integrations/users?email=user@example.com
 *     -> { ok, exists, user }
 * 2) Paginated list (minimal fields):    /api/integrations/users?page=1&limit=50&status=ACTIVE&role=USER&q=foo&includeAdmins=false    -> { ok, page, limit, total, users:[{id,email,name,status,role}] }*Notes:- limit is capped to 100.- By default excludes ADMIN users and returns only ACTIVE users.*/
export async function GET(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();

  // ---- Mode 1: email lookup ----
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, status: true, role: true },
    });

    return NextResponse.json(
      { ok: true, exists: !!user, user: user || null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // ---- Mode 2: list with pagination & filters ----
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const status = (url.searchParams.get("status") || "ACTIVE").toUpperCase(); // ACTIVE|PENDING|SUSPENDED|any
  const role = (url.searchParams.get("role") || "USER").toUpperCase(); // USER|ADMIN|any
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const includeAdmins = (url.searchParams.get("includeAdmins") || "false").toLowerCase() === "true";

  // Build Prisma where
  const where: any = {};

  if (status !== "ANY") where.status = status; // default ACTIVE
  if (role !== "ANY") {
    if (role === "ADMIN") {
      if (!includeAdmins) {
        // explicit request for admins but includeAdmins=false -> deny
        return NextResponse.json(
          { ok: false, error: "admins_listing_disabled", hint: "Pass includeAdmins=true to include role=ADMIN." },
          { status: 403 }
        );
      }
      where.role = "ADMIN";
    } else {
      where.role = "USER";
      if (!includeAdmins) {
        // default path; no change
      }
    }
  } else if (!includeAdmins) {
    // role=ANY but do NOT include admins by default
    where.role = { not: "ADMIN" };
  }

  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name:  { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" }, // or email: "asc"
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, email: true, name: true, status: true, role: true },
    }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      users,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}