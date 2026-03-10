import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { currentUser } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "Files";

function transliterateGreek(input: string) {
  const map: Record<string, string> = {
    Α: "A", Β: "V", Γ: "G", Δ: "D", Ε: "E", Ζ: "Z", Η: "I", Θ: "TH",
    Ι: "I", Κ: "K", Λ: "L", Μ: "M", Ν: "N", Ξ: "X", Ο: "O", Π: "P",
    Ρ: "R", Σ: "S", Τ: "T", Υ: "Y", Φ: "F", Χ: "CH", Ψ: "PS", Ω: "O",
    α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th",
    ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
    ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
    Ά: "A", Έ: "E", Ή: "I", Ί: "I", Ό: "O", Ύ: "Y", Ώ: "O",
    ά: "a", έ: "e", ή: "i", ί: "i", ό: "o", ύ: "y", ώ: "o",
    Ϊ: "I", Ϋ: "Y", ϊ: "i", ϋ: "y", ΐ: "i", ΰ: "y",
  };

  return Array.from(input || "")
    .map((ch) => map[ch] ?? ch)
    .join("");
}

function normalizeName(input: string) {
  return transliterateGreek(String(input || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._@-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function safeAsciiFilename(name: string) {
  return normalizeName(name);
}

function safeLegacyFilename(name: string) {
  return String(name || "")
    .replace(/[^\w.\-@]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dedupe<T>(arr: T[]) {
  return [...new Set(arr)];
}

function splitRequestedPath(requestedKeyPath: string) {
  const prefix = "uploads/";
  const rest = requestedKeyPath.startsWith(prefix)
    ? requestedKeyPath.slice(prefix.length)
    : requestedKeyPath;

  const scopedIdx = rest.indexOf("__");

  if (scopedIdx >= 0) {
    return {
      scope: rest.slice(0, scopedIdx),
      fileName: rest.slice(scopedIdx + 2),
    };
  }

  return {
    scope: null as string | null,
    fileName: rest,
  };
}

function buildCandidateKeys(requestedKeyPath: string) {
  const { scope, fileName } = splitRequestedPath(requestedKeyPath);

  const decodedFileName = decodeURIComponent(fileName);
  const asciiFileName = safeAsciiFilename(decodedFileName);
  const legacyFileName = safeLegacyFilename(decodedFileName);

  const out = [
    requestedKeyPath,
    `uploads/${decodedFileName}`,
    `uploads/${asciiFileName}`,
    `uploads/${legacyFileName}`,
  ];

  if (scope) {
    out.push(
      `uploads/${scope}__${decodedFileName}`,
      `uploads/${scope}__${asciiFileName}`,
      `uploads/${scope}__${legacyFileName}`
    );
  }

  return dedupe(out.filter(Boolean));
}

function filenameFromKey(keyPath: string) {
  const parts = String(keyPath || "").split("/");
  return parts[parts.length - 1] || keyPath;
}

async function trySign(
  supabase: ReturnType<typeof createClient>,
  keyPath: string,
  expiresSec: number
) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(keyPath, expiresSec);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function findByListingUploads(
  supabase: ReturnType<typeof createClient>,
  requestedKeyPath: string
) {
  const { fileName } = splitRequestedPath(requestedKeyPath);

  const targetRaw = decodeURIComponent(fileName);
  const targetNorm = normalizeName(targetRaw);
  const targetLegacy = safeLegacyFilename(targetRaw).toLowerCase();

  const { data, error } = await supabase.storage.from(BUCKET).list("uploads", {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error || !data) {
    return {
      matchedKey: null as string | null,
      listedCount: 0,
    };
  }

  let exactNormMatch: string | null = null;
  let containsNormMatch: string | null = null;
  let legacyMatch: string | null = null;

  for (const item of data) {
    if (!item?.name) continue;

    const objectName = item.name; // e.g. "MARIA_KORAKAKI_Health_....xlsx"
    const objectKey = `uploads/${objectName}`;

    const objectNorm = normalizeName(objectName);
    const objectLegacy = safeLegacyFilename(objectName).toLowerCase();

    if (objectNorm === targetNorm) {
      exactNormMatch = objectKey;
      break;
    }

    if (!containsNormMatch && objectNorm.includes(targetNorm)) {
      containsNormMatch = objectKey;
    }

    if (!legacyMatch && objectLegacy === targetLegacy) {
      legacyMatch = objectKey;
    }
  }

  return {
    matchedKey: exactNormMatch || legacyMatch || containsNormMatch || null,
    listedCount: data.length,
  };
}

export async function GET(req: Request, ctx: { params: { key: string[] } }) {
  try {
    const requestedKeyPath = decodeURIComponent((ctx.params.key || []).join("/"));
    if (!requestedKeyPath) {
      return NextResponse.json({ error: "key_missing" }, { status: 400 });
    }

    const expiresSec = Number(new URL(req.url).searchParams.get("expires")) || 60 * 60;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const triedKeys = buildCandidateKeys(requestedKeyPath);

    for (const keyPath of triedKeys) {
      const signedUrl = await trySign(supabase, keyPath, expiresSec);
      if (signedUrl) {
        const me = await currentUser().catch(() => null);

        await logAudit({
          action: "DOWNLOAD_GRANTED",
          target: "File",
          targetId: keyPath,
          actorId: (me as any)?.id ?? null,
          meta: {
            key: keyPath,
            requestedKeyPath,
            expires: expiresSec,
            bucket: BUCKET,
            resolvedVia: "direct_key",
          },
        }).catch(() => {});

        return NextResponse.redirect(signedUrl, { status: 302 });
      }
    }

    // Fallback: search inside uploads/ by normalized filename
    const listed = await findByListingUploads(supabase, requestedKeyPath);

    if (listed.matchedKey) {
      const signedUrl = await trySign(supabase, listed.matchedKey, expiresSec);

      if (signedUrl) {
        const me = await currentUser().catch(() => null);

        await logAudit({
          action: "DOWNLOAD_GRANTED",
          target: "File",
          targetId: listed.matchedKey,
          actorId: (me as any)?.id ?? null,
          meta: {
            key: listed.matchedKey,
            requestedKeyPath,
            expires: expiresSec,
            bucket: BUCKET,
            resolvedVia: "uploads_listing_fallback",
            listedCount: listed.listedCount,
          },
        }).catch(() => {});

        return NextResponse.redirect(signedUrl, { status: 302 });
      }
    }

    return NextResponse.json(
      {
        error: "sign_failed",
        detail: "Object not found",
        bucket: BUCKET,
        requestedKeyPath,
        triedKeys,
        listingFallbackTried: true,
        listingMatchedKey: listed.matchedKey,
        listedCount: listed.listedCount,
      },
      { status: 500 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "unexpected", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}