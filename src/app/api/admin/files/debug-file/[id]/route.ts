import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getAdminClient, getBucket } from "@/lib/storage-supabase";

export const runtime = "nodejs";

function extractStorageKeyFromUrl(url?: string | null) {
  if (!url) return null;
  const m = url.match(/\/api\/files\/download\/(.+)$/);
  if (!m) return null;

  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

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

async function listAllRecursive(
  prefix: string,
  maxDepth = 4
): Promise<string[]> {
  const supabase = getAdminClient();
  const bucket = getBucket();
  const results: string[] = [];

  async function walk(path: string, depth: number) {
    if (depth > maxDepth) return;

    const { data, error } = await supabase.storage.from(bucket).list(path, {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

    if (error || !data) return;

    for (const item of data) {
      if (!item?.name) continue;

      const childPath = path ? `${path}/${item.name}` : item.name;
      const isFolder = !item.id;

      if (isFolder) {
        await walk(childPath, depth + 1);
      } else {
        results.push(childPath);
      }
    }
  }

  await walk(prefix, 0);
  return results;
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const fileId = ctx.params.id;

  try {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        title: true,
        originalName: true,
        url: true,
        mime: true,
        size: true,
        createdAt: true,
        uploadedById: true,
        assignments: {
          select: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const bucket = getBucket();
    const supabase = getAdminClient();
    const storageKey = extractStorageKeyFromUrl(file.url);
    const targetName = file.originalName || file.title || "";
    const targetNorm = normalizeName(targetName);

    let exactSignedUrlOk = false;
    let exactSignedUrlError: string | null = null;

    if (storageKey) {
      const { error } = await supabase.storage.from(bucket).createSignedUrl(storageKey, 60);
      if (!error) {
        exactSignedUrlOk = true;
      } else {
        exactSignedUrlError = error.message;
      }
    }

    const allUploadObjects = await listAllRecursive("uploads", 4);

    const similar = allUploadObjects
      .map((key) => {
        const filename = key.split("/").pop() || "";
        return {
          key,
          filename,
          normalized: normalizeName(filename),
        };
      })
      .filter((x) => {
        if (!targetNorm) return false;
        return (
          x.normalized === targetNorm ||
          x.normalized.includes(targetNorm) ||
          targetNorm.includes(x.normalized)
        );
      })
      .slice(0, 50);

    return NextResponse.json({
      ok: true,
      bucket,
      file,
      storageKey,
      exactSignedUrlOk,
      exactSignedUrlError,
      uploadsObjectCount: allUploadObjects.length,
      similarMatches: similar,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "debug_failed",
        detail: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}