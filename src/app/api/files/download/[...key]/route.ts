// src/app/api/files/download/[...key]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { currentUser } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "Files"; // ίδιο bucket με uploads / admin files

export async function GET(req: Request, ctx: { params: { key: string[] } }) {
  try {
    const keyPath = decodeURIComponent((ctx.params.key || []).join("/"));
    if (!keyPath) {
      return NextResponse.json({ error: "key_missing" }, { status: 400 });
    }

    const expiresSec =
      Number(new URL(req.url).searchParams.get("expires")) || 60 * 60;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(keyPath, expiresSec);

    if (error) {
      return NextResponse.json(
        {
          error: "sign_failed",
          detail: error.message,
          bucket: BUCKET,
          keyPath,
        },
        { status: 500 }
      );
    }

    const me = await currentUser().catch(() => null);

    await logAudit({
      action: "DOWNLOAD_GRANTED",
      target: "File",
      targetId: keyPath,
      actorId: (me as any)?.id ?? null,
      meta: {
        key: keyPath,
        expires: expiresSec,
        bucket: BUCKET,
      },
    }).catch(() => {});

    return NextResponse.redirect(data.signedUrl, { status: 302 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "unexpected", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}