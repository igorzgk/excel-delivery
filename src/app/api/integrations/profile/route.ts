// src/app/api/integrations/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";

export const runtime = "nodejs";

/**
 * GET /api/integrations/profile?email=user@example.com
 * Headers: x-api-key: YOUR_PLAIN_KEY
 * Returns minimal user + full profile fields
 */
export async function GET(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "missing_email_param" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, status: true, role: true },
  });
  if (!user) return NextResponse.json({ ok: true, exists: false });

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({ ok: true, exists: true, user, profile });
}
