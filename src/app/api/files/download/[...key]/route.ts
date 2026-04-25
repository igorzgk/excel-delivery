import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { currentUser } from "@/lib/auth-helpers";
import { getBucket, supabaseCreateSignedUrl } from "@/lib/storage-supabase";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: { key: string[] } }) {
  try {
    const keyPath = decodeURIComponent((ctx.params.key || []).join("/"));

    if (!keyPath) {
      return NextResponse.json({ error: "key_missing" }, { status: 400 });
    }

    const expiresSec =
      Number(new URL(req.url).searchParams.get("expires")) || 60 * 60;

    const url = new URL(req.url);
    const forceDownload = url.searchParams.get("download") === "1";

    const signed = await supabaseCreateSignedUrl(keyPath, expiresSec, {
      download: forceDownload,
    });

    const me = await currentUser().catch(() => null);

    await logAudit({
      action: "DOWNLOAD_GRANTED",
      target: "File",
      targetId: keyPath,
      actorId: (me as any)?.id ?? null,
      meta: {
        key: keyPath,
        expires: expiresSec,
        bucket: getBucket(),
      },
    }).catch(() => {});

    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "sign_failed",
        detail: err?.message || "Unknown error",
        bucket: getBucket(),
      },
      { status: 500 }
    );
  }
}