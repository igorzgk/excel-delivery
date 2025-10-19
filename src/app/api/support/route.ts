// src/app/api/support/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const subject = String(body.subject || "").slice(0, 140);
    const message = String(body.message || "").slice(0, 5000);
    const priority = String(body.priority || "normal");

    if (!subject || !message) {
      return NextResponse.json({ error: "validation", detail: "subject and message are required" }, { status: 400 });
    }

    // record to audit log (no schema changes needed)
    await logAudit({
      action: "SUPPORT_TICKET",
      target: "Ticket",
      targetId: null,
      actorId: (me as any).id,
      meta: {
        subject,
        message,
        priority,
        userEmail: (me as any).email,
        userName: (me as any).name,
        userAgent: req.headers.get("user-agent") || "",
      },
    });

    // optional mailto helper for teams without email provider
    const supportEmail = process.env.SUPPORT_EMAIL || "support@hygiene-plus.gr";
    const mailto = `mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent(
      `[HygienePlus] ${subject} (${priority})`
    )}&body=${encodeURIComponent(message + `\n\n— ${((me as any).email || "")}`)}`;

    return NextResponse.json({ ok: true, mailto });
  } catch (err: any) {
    return NextResponse.json({ error: "support_failed", detail: err?.message || String(err) }, { status: 500 });
  }
}
