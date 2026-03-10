import { createClient } from "@supabase/supabase-js";

export function getAdminClient() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("storage_not_configured: missing Supabase env vars");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export function getBucket() {
  return process.env.SUPABASE_BUCKET || "Files";
}

export async function supabaseRemove(paths: string[]) {
  const supabase = getAdminClient();
  const bucket = getBucket();

  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);

  return { ok: true };
}

export async function supabasePutBuffer(
  path: string,
  buf: Buffer,
  contentType?: string
) {
  const supabase = getAdminClient();
  const bucket = getBucket();

  const { error } = await supabase.storage.from(bucket).upload(path, buf, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });

  if (error) throw new Error(error.message);

  return { ok: true, signedUrl: null as string | null };
}

export async function supabaseCreateSignedUrl(path: string, expiresSec = 3600) {
  const supabase = getAdminClient();
  const bucket = getBucket();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresSec);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "createSignedUrl failed");
  }

  return { ok: true, signedUrl: data.signedUrl };
}

export async function supabaseObjectExists(path: string) {
  const supabase = getAdminClient();
  const bucket = getBucket();

  const { error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);

  if (!error) return true;

  const msg = (error.message || "").toLowerCase();
  if (msg.includes("not found") || msg.includes("object not found")) {
    return false;
  }

  throw new Error(error.message);
}