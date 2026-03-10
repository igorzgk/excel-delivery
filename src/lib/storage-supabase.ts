// src/lib/storage-supabase.ts
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("storage_not_configured: SUPABASE URL or SERVICE ROLE key missing");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function getBucket() {
  return process.env.SUPABASE_BUCKET || "Files";
}

export async function supabaseRemove(paths: string[]) {
  const supabase = getAdminClient();
  const bucket = getBucket();

  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);

  return { ok: true };
}

export async function supabasePutBuffer(path: string, buf: Buffer, contentType?: string) {
  const supabase = getAdminClient();
  const bucket = getBucket();

  const { error } = await supabase.storage.from(bucket).upload(path, buf, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });

  if (error) throw new Error(error.message);

  return { ok: true, signedUrl: null as string | null };
}