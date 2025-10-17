// src/lib/storage-supabase.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE!; // server-only
const bucket = process.env.SUPABASE_BUCKET!;

const supa = createClient(url, key, { auth: { persistSession: false } });

export async function supabasePutBuffer(
  keyPath: string,
  buf: Buffer,
  contentType?: string
) {
  const { error } = await supa.storage.from(bucket).upload(keyPath, buf, {
    contentType: contentType || "application/octet-stream",
    upsert: true, // overwrite if same key
  });
  if (error) throw error;

  // Create a short-lived signed URL for downloads (e.g., 24h)
  const { data: signed, error: signErr } = await supa.storage
    .from(bucket)
    .createSignedUrl(keyPath, 60 * 60 * 24);

  if (signErr) throw signErr;
  return { key: keyPath, signedUrl: signed?.signedUrl ?? null };
}
