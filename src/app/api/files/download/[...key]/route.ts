import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { currentUser } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = process.env.SUPABASE_BUCKET || "Files";

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function buildFallbackKeys(rawKeyPath: string) {
  const decoded = decodeURIComponent(rawKeyPath || "").replace(/^\/+/, "");
  if (!decoded) return [];

  const candidates = [decoded];

  // Case A:
  // uploads/user@email.com/file.xlsx
  // -> uploads/user@email.com__file.xlsx
  const mScoped = decoded.match(/^uploads\/([^/]+)\/([^/]+)$/);
  if (mScoped) {
    const [, scope, filename] = mScoped;
    candidates.push(`uploads/${scope}__${filename}`);
    candidates.push(`uploads/${filename}`);
  }

  // Case B:
  // uploads/user@email.com__file.xlsx
  // -> uploads/file.xlsx
  const mFlatScoped = decoded.match(/^uploads\/([^/]+)__([^/]+)$/);
  if (mFlatScoped) {
    const [, _scope, filename] = mFlatScoped;
    candidates.push(`uploads/${filename}`);
  }

  return uniq(candidates);
}

export async function GET(
  req: Request,
  ctx: { params: { key: string[] } }
) {
  try {
    const rawKeyPath = (ctx.params.key || []).join("/");
    if (!rawKeyPath) {
      return NextResponse.json({ error: "key_missing" }, { status: 400 });
    }

    const expiresSec =
      Number(new URL(req.url).searchParams.get("expires")) || 60 * 60;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const candidateKeys = buildFallbackKeys(rawKeyPath);

    let signedUrl: string | null = null;
    let resolvedKey: string | null = null;
    let lastError: string | null = null;

    for (const candidate of candidateKeys) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(candidate, expiresSec);

      if (!error && data?.signedUrl) {
        signedUrl = data.signedUrl;
        resolvedKey = candidate;
        break;
      }

      lastError = error?.message || null;
    }

    if (!signedUrl || !resolvedKey) {
      return NextResponse.json(
        {
          error: "sign_failed",
          detail: lastError || "Object not found",
          bucket: BUCKET,
          requestedKeyPath: decodeURIComponent(rawKeyPath),
          triedKeys: candidateKeys,
          supabaseUrl: SUPABASE_URL,
        },
        { status: 500 }
      );
    }

    const me = await currentUser().catch(() => null);

    await logAudit({
      action: "DOWNLOAD_GRANTED",
      target: "File",
      targetId: resolvedKey,
      actorId: (me as any)?.id ?? null,
      meta: {
        requestedKey: decodeURIComponent(rawKeyPath),
        resolvedKey,
        expires: expiresSec,
        bucket: BUCKET,
      },
    }).catch(() => {});

    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "unexpected", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}