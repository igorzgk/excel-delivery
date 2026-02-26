// src/lib/storage-supabase.ts
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("storage_not_configured: SUPABASE_URL or SUPABASE_SERVICE_ROLE missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function getBucket() {
  return process.env.SUPABASE_BUCKET || "Files";
}

export async function supabaseRemove(paths: string[]) {
  const supabase = getAdminClient();
  const bucket = getBucket();

  // remove() δεν "σπάει" αν το αρχείο δεν υπάρχει
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw new Error(error.message);

  return { ok: true };
}

export async function supabasePutBuffer(path: string, buf: Buffer, contentType?: string) {
  const supabase = getAdminClient();
  const bucket = getBucket();

  const { error } = await supabase.storage.from(bucket).upload(path, buf, {
    contentType: contentType || "application/octet-stream",
    upsert: true, // 👈 σημαντικό για replace
  });

  if (error) throw new Error(error.message);

  // (προαιρετικό) signed url δεν χρειάζεται για την αποθήκευση.
  // Αν ήδη το χρησιμοποιείς, κράτα το όπως ήταν. Εδώ επιστρέφω null για συμβατότητα.
  return { ok: true, signedUrl: null as string | null };
}
