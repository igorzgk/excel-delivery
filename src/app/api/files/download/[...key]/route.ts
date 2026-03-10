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

function safeAsciiFilename(name: string) {
  return transliterateGreek(String(name || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._@()-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function safeLegacyFilename(name: string) {
  return String(name || "").replace(/[^\w.\-@]+/g, "_");
}

function dedupe<T>(arr: T[]) {
  return [...new Set(arr)];
}

function splitRequestedPath(requestedKeyPath: string) {
  const prefix = "uploads/";
  let rest = requestedKeyPath.startsWith(prefix)
    ? requestedKeyPath.slice(prefix.length)
    : requestedKeyPath;

  const idx = rest.indexOf("__");

  if (idx >= 0) {
    return {
      hasScopedPrefix: true,
      scope: rest.slice(0, idx),
      fileName: rest.slice(idx + 2),
    };
  }

  return {
    hasScopedPrefix: false,
    scope: null as string | null,
    fileName: rest,
  };
}

function buildCandidateKeys(requestedKeyPath: string) {
  const { scope, fileName } = splitRequestedPath(requestedKeyPath);

  const decodedFileName = decodeURIComponent(fileName);
  const asciiFileName = safeAsciiFilename(decodedFileName);
  const legacyFileName = safeLegacyFilename(decodedFileName);

  const candidates = [
    requestedKeyPath,
    `uploads/${decodedFileName}`,
    `uploads/${asciiFileName}`,
    `uploads/${legacyFileName}`,
  ];

  if (scope) {
    candidates.push(
      `uploads/${scope}__${decodedFileName}`,
      `uploads/${scope}__${asciiFileName}`,
      `uploads/${scope}__${legacyFileName}`
    );
  }

  return dedupe(candidates.filter(Boolean));
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
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(keyPath, expiresSec);

      if (!error && data?.signedUrl) {
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
          },
        }).catch(() => {});

        return NextResponse.redirect(data.signedUrl, { status: 302 });
      }
    }

    return NextResponse.json(
      {
        error: "sign_failed",
        detail: "Object not found",
        bucket: BUCKET,
        requestedKeyPath,
        triedKeys,
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