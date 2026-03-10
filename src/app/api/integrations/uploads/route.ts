import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";
import { supabasePutBuffer, supabaseRemove } from "@/lib/storage-supabase";
import { logAudit } from "@/lib/audit";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  title: z.string().optional(),
  url: z.string().url(),
  originalName: z.string().optional(),
  uploadedByEmail: z.string().email().optional(),
});

const SchemaDoc = {
  endpoint: "POST /api/integrations/uploads",
  expectsHeaders: {
    "x-api-key": "YOUR_PLAIN_KEY",
    "Content-Type": "application/json",
  },
  expectsBody: {
    title: "string (optional, used as display title; falls back to filename)",
    url: "string (required, public or signed URL)",
    originalName: "string (optional; if given, used for display/filename heuristics)",
    uploadedByEmail: "string (optional; attribution if it matches a user)",
  },
  notes: [
    "Auto-assign: ανιχνεύουμε emails μέσα σε title/originalName/url.",
    "Το storage key γράφεται μόνο με ασφαλείς ASCII χαρακτήρες.",
    "Το originalName στη βάση κρατά το πραγματικό filename (και ελληνικά).",
    "Το replace γίνεται μόνο για παλιότερα monthly versions του ίδιου assignee.",
    "Επιστρέφουμε πάντα JSON.",
  ],
};

async function getAssignerId(uploadedById?: string | null) {
  if (uploadedById) {
    const u = await prisma.user.findUnique({
      where: { id: uploadedById },
      select: { role: true },
    });
    if (u?.role === "ADMIN") return uploadedById;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });

  return admin?.id ?? null;
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

function safeStoragePart(v: string) {
  return transliterateGreek(String(v || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9.\-@_()]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeFilenameForDedup(name: string) {
  const n = String(name || "").trim();
  if (!n) return "";

  const dot = n.lastIndexOf(".");
  const ext = dot > 0 ? n.slice(dot).toLowerCase() : "";
  let base = dot > 0 ? n.slice(0, dot) : n;

  base = transliterateGreek(base)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  base = base.replace(/([_\-\s])?(0?[1-9]|1[0-2])([_\-\s])\d{4}$/i, "");

  base = base
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${base}${ext}`;
}

function extractStorageKeyFromDownloadUrl(url?: string | null) {
  if (!url) return null;
  const m = url.match(/\/api\/files\/download\/(.+)$/);
  if (!m) return null;

  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

async function dedupeForAssignee(params: {
  assigneeId: string;
  keepFileId: string;
  keepOriginalName: string;
}) {
  const { assigneeId, keepFileId, keepOriginalName } = params;

  const dedupeKey = normalizeFilenameForDedup(keepOriginalName);
  if (!dedupeKey) return { deletedOldRecords: 0 };

  const existingAssignments = await prisma.fileAssignment.findMany({
    where: { userId: assigneeId },
    select: {
      id: true,
      fileId: true,
      file: {
        select: {
          id: true,
          originalName: true,
          url: true,
        },
      },
    },
  });

  const duplicates = existingAssignments.filter((a) => {
    if (a.fileId === keepFileId) return false;
    const candidateKey = normalizeFilenameForDedup(a.file.originalName || "");
    return candidateKey === dedupeKey;
  });

  let deletedOldRecords = 0;

  for (const dup of duplicates) {
    await prisma.fileAssignment.deleteMany({
      where: {
        fileId: dup.fileId,
        userId: assigneeId,
      },
    });

    const remainingAssignments = await prisma.fileAssignment.count({
      where: { fileId: dup.fileId },
    });

    if (remainingAssignments === 0) {
      const storageKey = extractStorageKeyFromDownloadUrl(dup.file.url);
      if (storageKey) {
        try {
          await supabaseRemove([storageKey]);
        } catch {
          // ignore storage cleanup failure
        }
      }

      await prisma.file.delete({
        where: { id: dup.fileId },
      });

      deletedOldRecords += 1;
    }
  }

  return { deletedOldRecords };
}

export async function GET(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  return NextResponse.json(
    {
      ok: true,
      ...SchemaDoc,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  let data: z.infer<typeof BodySchema>;
  try {
    data = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const r = await fetch(data.url, { redirect: "follow" });
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: `Fetch failed (${r.status})` },
      { status: 400 }
    );
  }

  const contentType = r.headers.get("content-type") || "application/octet-stream";
  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);

  let uploadedById: string | undefined;
  if (data.uploadedByEmail) {
    const u = await prisma.user.findUnique({
      where: { email: data.uploadedByEmail },
      select: { id: true },
    });
    uploadedById = u?.id;
  }

  const assignerId = await getAssignerId(uploadedById);

  const originalNameForDb = String(data.originalName || data.title || "upload.xlsx").trim();
  const titleForDb = String(data.title || originalNameForDb).trim();

  const candidates = Array.from(
    new Set([
      ...extractEmailsFromText(`${originalNameForDb} ${titleForDb} ${data.url}`),
      ...(data.uploadedByEmail ? [data.uploadedByEmail] : []),
    ])
  );

  const assigneeIds = candidates.length
    ? await resolveAssigneeIdsByEmails(candidates)
    : [];

  let assignmentCreated = false;
  let warning: string | null = null;
  let assigneeScope = "unassigned";

  if (candidates.length > 0) {
    assigneeScope = candidates[0].toLowerCase();
  } else if (data.uploadedByEmail) {
    assigneeScope = data.uploadedByEmail.toLowerCase();
  }

  const safeScopeForStorage = safeStoragePart(assigneeScope || "unassigned");
  const safeNameForStorage = safeStoragePart(originalNameForDb || "upload.xlsx");

  const keyPath = `uploads/${safeScopeForStorage}__${safeNameForStorage}`;

  try {
    await supabaseRemove([keyPath]);
  } catch {
    // ignore storage remove errors
  }

  const put = await supabasePutBuffer(keyPath, buf, contentType);
  const publicUrl = `/api/files/download/${keyPath}`;

  const record = await prisma.file.create({
    data: {
      title: titleForDb,
      originalName: originalNameForDb,
      url: publicUrl,
      mime: contentType,
      size: buf.byteLength,
      uploadedById,
    },
    select: {
      id: true,
      title: true,
      originalName: true,
      url: true,
      createdAt: true,
    },
  });

  if (assigneeIds.length && assignerId) {
    await prisma.fileAssignment.createMany({
      data: assigneeIds.map((userId) => ({
        fileId: record.id,
        userId,
        assignedById: assignerId,
      })),
      skipDuplicates: true,
    });
    assignmentCreated = true;
  } else {
    warning =
      assigneeIds.length === 0
        ? "No assignee resolved from filename/title/url/uploadedByEmail"
        : "No assignerId found";
  }

  let deletedOldRecords = 0;

  if (assigneeIds.length) {
    for (const assigneeId of assigneeIds) {
      const dedupe = await dedupeForAssignee({
        assigneeId,
        keepFileId: record.id,
        keepOriginalName: record.originalName || "",
      });
      deletedOldRecords += dedupe.deletedOldRecords;
    }
  }

  await logAudit({
    action: "FILE_UPLOADED",
    target: "File",
    targetId: record.id,
    meta: {
      via: "integration_url_ingest",
      sourceUrl: data.url,
      mime: contentType,
      size: buf.byteLength,
      emails: candidates,
      warning,
      assigned: assigneeIds.length,
      assignmentCreated,
      assignerId,
      storageKey: keyPath,
      replaced: true,
      deletedOldRecords,
      dedupeKey: normalizeFilenameForDedup(record.originalName || ""),
      fileId: record.id,
      title: record.title,
      originalName: record.originalName,
      assigneeScope,
      safeScopeForStorage,
      safeNameForStorage,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      file: record,
      assignedCount: assigneeIds.length,
      assignmentCreated,
      key: keyPath,
      signedUrl: put.signedUrl,
      replaced: true,
      deletedOldRecords,
      warning,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}