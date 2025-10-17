// src/app/api/integrations/upload-multipart/route.ts
import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/apiKeyAuth";
import { supabasePutBuffer } from "@/lib/storage-supabase";
import { checkExt, MAX_BYTES } from "@/lib/files-validate";

export async function POST(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  const form = await req.formData();
  const file = form.get("file") as unknown as File | null;
  const title = String(form.get("title") || "");

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  try {
    checkExt(file.name || "");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 415 });
  }

  // @ts-ignore (size may not be in TS lib yet)
  const size = (file as any).size as number | undefined;
  if (typeof size === "number" && size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const ab = await file.arrayBuffer();
  if (!size && ab.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }
  const buf = Buffer.from(ab);
  const contentType =
    (file as any).type ||
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const now = new Date();
  const name = file.name || "upload.xlsx";
  const keyPath = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2,"0")}/${Date.now()}_${name}`;

  try {
    const put = await supabasePutBuffer(keyPath, buf, contentType);

    // TODO: create DB record, run auto-assignment from filename/email, audit log, etc.

    return NextResponse.json({
      ok: true,
      file: {
        title: title || name,
        originalName: name,
        contentType,
        size: buf.byteLength,
        key: put.key,
        signedUrl: put.signedUrl,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Store failed" }, { status: 500 });
  }
}
