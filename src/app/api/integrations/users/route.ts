// src/app/api/integrations/users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";

export const runtime = "nodejs";

/**GET /api/integrations/users?email=user@example.comHeaders:  x-api-key: YOUR_PLAIN_KEYReturns:  { ok: true, exists: boolean, user?: { id, email, name, status, role } }*/
export async function GET(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "missing_email_param" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, status: true, role: true },
  });

  return NextResponse.json(
    { ok: true, exists: !!user, user: user || null },
    { headers: { "Cache-Control": "no-store" } }
  );
}