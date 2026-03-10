import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";
import { supabasePutBuffer, supabaseRemove } from "@/lib/storage-supabase";
import { logAudit } from "@/lib/audit";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";

export const runtime = "nodejs";

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
  const n = (name || "").trim();
  if (!n) return "";

  const dot = n.lastIndexOf(".");
  const base = dot > 0 ? n.slice(0, dot) : n;
  const ext = dot > 0 ? n.slice(dot) : "";

  const cleanedBase = base.replace(/([_-])?(0?[1-9]|1[0-2])([_-])\d{4}$/i, "");

  return (cleanedBase + ext).toLowerCase();
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
          // ignore storage delete errors
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
      endpoint: "POST /api/integrations/upload-multipart",
      expectsHeaders: {
        "x-api-key": "YOUR_PLAIN_KEY",
      },
      expectsBody: {
        title: "string (required)",
        file: "File (required)",
        uploadedByEmail: "string (optional)",
      },
      notes: [
        "Το storage key γράφεται μόνο με ασφαλείς ASCII χαρακτήρες.",
        "Το originalName στη βάση κρατά το πραγματικό filename (και ελληνικά).",
        "Το replace γίνεται μόνο για παλαιότερα monthly versions του ίδιου assignee.",
      ],
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "unsupported_media_type", hint: "Use multipart/form-data" },
      { status: 415, headers: { "Cache-Control": "no-store" } }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_multipart" }, { status: 400 });
  }

  const title = String(form.get("title") || "").trim();
  const file = form.get("file") as File | null;
  const uploadedByEmail =
    (String(form.get("uploadedByEmail") || "").trim() || undefined) as string | undefined;

  if (!title || !file) {
    return NextResponse.json(
      { ok: false, error: "missing_fields", detail: "title and file are required" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const originalNameRaw = (file as any).name || `${title}.xlsx`;
  const originalNameForDb = String(originalNameRaw).trim();

  const contentTypeRaw = (file.type || "").toLowerCase();
  const contentType =
    contentTypeRaw ||
    (originalNameForDb.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/octet-stream");

  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);

  let uploadedById: string | undefined;
  if (uploadedByEmail) {
    const u = await prisma.user.findUnique({
      where: { email: uploadedByEmail },
      select: { id: true },
    });
    uploadedById = u?.id;
  }

  const assignerId = await getAssignerId(uploadedById);

  const candidates = Array.from(
    new Set([
      ...extractEmailsFromText(`${title} ${originalNameForDb}`),
      ...(uploadedByEmail ? [uploadedByEmail] : []),
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
  } else if (uploadedByEmail) {
    assigneeScope = uploadedByEmail.toLowerCase();
  }

  const safeScopeForStorage = safeStoragePart(assigneeScope || "unassigned");
  const safeNameForStorage = safeStoragePart(originalNameForDb || "upload.xlsx");

  const keyPath = `uploads/${safeScopeForStorage}__${safeNameForStorage}`;

  try {
    await supabaseRemove([keyPath]);
  } catch {
    // ignore
  }

  const put = await supabasePutBuffer(keyPath, buf, contentType);
  const publicUrl = `/api/files/download/${keyPath}`;

  const record = await prisma.file.create({
    data: {
      title,
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
    warning = assigneeIds.length === 0
      ? "No assignee resolved from filename/title/uploadedByEmail"
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
      via: "integration_multipart_ingest",
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
      fileId: record.id,
      title,
      originalName: originalNameForDb,
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