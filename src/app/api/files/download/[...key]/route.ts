import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { currentUser } from "@/lib/auth-helpers";

export const runtime = "nodejs";

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("storage_not_configured");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function getBucket() {
  return process.env.SUPABASE_BUCKET || "Files";
}

function buildCandidateKeys(rawKeyPath: string) {
  const decoded = decodeURIComponent(rawKeyPath).replace(/^\/+/, "");
  const keys = new Set<string>();

  keys.add(decoded);
  keys.add(decoded.replace(/\/+/g, "/"));

  const filenameOnly = decoded.replace(/^uploads\/[^/]+__/, "uploads/");
  if (filenameOnly !== decoded) keys.add(filenameOnly);

  const withoutUploads = decoded.replace(/^uploads\//, "");
  if (withoutUploads !== decoded) keys.add(`uploads/${withoutUploads}`);

  return Array.from(keys);
}

export async function GET(req: Request, ctx: { params: { key: string[] } }) {
  try {
    const keyPath = decodeURIComponent((ctx.params.key || []).join("/"));
    if (!keyPath) {
      return NextResponse.json({ error: "key_missing" }, { status: 400 });
    }

    const expiresSec =
      Number(new URL(req.url).searchParams.get("expires")) || 60 * 60;

    const supabase = getAdminClient();
    const bucket = getBucket();
    const triedKeys = buildCandidateKeys(keyPath);

    for (const candidate of triedKeys) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(candidate, expiresSec);

      if (!error && data?.signedUrl) {
        const me = await currentUser().catch(() => null);

        await logAudit({
          action: "DOWNLOAD_GRANTED",
          target: "File",
          targetId: candidate,
          actorId: (me as any)?.id ?? null,
          meta: {
            key: candidate,
            requestedKey: keyPath,
            expires: expiresSec,
            bucket,
          },
        }).catch(() => {});

        return NextResponse.redirect(data.signedUrl, { status: 302 });
      }
    }

    return NextResponse.json(
      {
        error: "sign_failed",
        detail: "Object not found",
        bucket,
        requestedKeyPath: keyPath,
        triedKeys,
      },
      { status: 500 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "unexpected", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}