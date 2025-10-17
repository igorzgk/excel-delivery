// src/app/api/files/download/[...key]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE!;
const bucket = process.env.SUPABASE_BUCKET!;

export async function GET(
  _req: Request,
  { params }: { params: { key: string[] } }
) {
  const keyPath = params.key.join("/");

  const supa = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supa.storage
    .from(bucket)
    .createSignedUrl(keyPath, 60 * 5); // 5 minutes

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
