// src/lib/storage-supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Create admin client only when needed (prevents build-time crashes). */
function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    // Throw only at runtime (API invocation), not at import time.
    throw new Error("storage_not_configured: SUPABASE_URL or SUPABASE_SERVICE_KEY missing");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getBucket(): string {
  return process.env.SUPABASE_BUCKET || "uploads";
}

/**
 * Upload a Buffer to Supabase Storage and return a short-lived signed URL.
 */
export async function supabasePutBuffer(
  keyPath: string,
  buf: Buffer,
  contentType: string
): Promise<{ key: string; signedUrl?: string }> {
  const supabase = getSupabaseAdmin();
  const bucket = getBucket();

  const upload = await supabase.storage.from(bucket).upload(keyPath, buf, {
    contentType,
    upsert: false,
  });

  if (upload.error) {
    throw new Error(`storage_upload_failed: ${upload.error.message}`);
  }

  const signed = await supabase.storage.from(bucket).createSignedUrl(keyPath, 60 * 60);
  // signedUrl can be undefined on old SDKs, so guard access
  const signedUrl = (signed as any)?.data?.signedUrl ?? (signed as any)?.signedUrl;

  return { key: keyPath, signedUrl };
}
