import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { currentUser } from "@/lib/auth-helpers";
import { getBucket, supabaseCreateSignedUrl } from "@/lib/storage-supabase";

export const runtime = "nodejs";

function cleanDownloadFilename(filename: string) {
  return filename.replace(
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}__?/i,
    ""
  );
}

export async function GET(
  req: Request,
  ctx: { params: { key: string[] } }
) {
  try {
    const keyPath = decodeURIComponent(
      (ctx.params.key || []).join("/")
    );

    if (!keyPath) {
      return NextResponse.json(
        { error: "key_missing" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);

    const expiresSec =
      Number(url.searchParams.get("expires")) || 60 * 60;

    const forceDownload =
      url.searchParams.get("download") === "1";

    /*
     * Keep the existing signed URL behaviour.
     *
     * We initially request the signed URL without forcing the
     * Supabase-generated download filename. If this is a download
     * request, we add our own clean filename afterwards.
     */
    const signed = await supabaseCreateSignedUrl(
      keyPath,
      expiresSec,
      {
        download: false,
      }
    );

    let finalSignedUrl = signed.signedUrl;

    if (forceDownload) {
      /*
       * Get only the filename from the storage path.
       *
       * Example:
       * folder/user@gmail.com__report.xlsx
       * ->
       * user@gmail.com__report.xlsx
       */
      const storedFilename =
        keyPath.split("/").pop() || "file";

      /*
       * Remove only the email prefix.
       *
       * user@gmail.com__report.xlsx
       * -> report.xlsx
       *
       * user@gmail.com_report.xlsx
       * -> report.xlsx
       */
      const downloadFilename =
        cleanDownloadFilename(storedFilename);

      /*
       * Supabase uses the "download" query parameter for the
       * Content-Disposition download filename.
       *
       * This changes ONLY the filename presented to the browser.
       * It does not rename anything in Storage or the database.
       */
      const signedUrl = new URL(signed.signedUrl);

      signedUrl.searchParams.set(
        "download",
        downloadFilename
      );

      finalSignedUrl = signedUrl.toString();
    }

    const me = await currentUser().catch(
      () => null
    );

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

    return NextResponse.redirect(
      finalSignedUrl,
      { status: 302 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "sign_failed",
        detail:
          err?.message || "Unknown error",
        bucket: getBucket(),
      },
      { status: 500 }
    );
  }
}