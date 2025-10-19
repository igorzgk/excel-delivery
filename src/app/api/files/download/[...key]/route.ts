// src/app/api/files/download/[...key]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { currentUser } from "@/lib/auth-helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE!; // server-only
const bucket = process.env.SUPABASE_BUCKET!;

export async function GET(req: Request, ctx: { params: { key: string[] } }) {
  try {
    const keyPath = decodeURIComponent((ctx.params.key || []).join("/"));
    if (!keyPath) return NextResponse.json({ error: "key_missing" }, { status: 400 });

    const expiresSec = Number(new URL(req.url).searchParams.get("expires")) || 60 * 60; // default 1h

    const supa = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await supa.storage.from(bucket).createSignedUrl(keyPath, expiresSec);
    if (error) return NextResponse.json({ error: "sign_failed", detail: error.message }, { status: 500 });

    // optional audit trail with user info if present
    const me = await currentUser().catch(() => null);
    await logAudit({
      action: "DOWNLOAD_GRANTED",
      target: "File",
      targetId: keyPath,
      actorId: (me as any)?.id ?? null,
      meta: { key: keyPath, expires: expiresSec },
    }).catch(() => {});

    return NextResponse.redirect(data!.signedUrl, { status: 302 });
  } catch (err: any) {
    return NextResponse.json({ error: "unexpected", detail: err?.message ?? String(err) }, { status: 500 });
  }
}
