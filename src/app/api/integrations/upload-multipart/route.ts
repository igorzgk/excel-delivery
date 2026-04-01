import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";
import {
  supabasePutBuffer,
  supabaseRemove,
  supabaseObjectExists,
} from "@/lib/storage-supabase";
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
    Α: "A",
    Β: "V",
    Γ: "G",
    Δ: "D",
    Ε: "E",
    Ζ: "Z",
    Η: "I",
    Θ: "TH",
    Ι: "I",
    Κ: "K",
    Λ: "L",
    Μ: "M",
    Ν: "N",
    Ξ: "X",
    Ο: "O",
    Π: "P",
    Ρ: "R",
    Σ: "S",
    Τ: "T",
    Υ: "Y",
    Φ: "F",
    Χ: "CH",
    Ψ: "PS",
    Ω: "O",
    α: "a",
    β: "v",
    γ: "g",
    δ: "d",
    ε: "e",
    ζ: "z",
    η: "i",
    θ: "th",
    ι: "i",
    κ: "k",
    λ: "l",
    μ: "m",
    ν: "n",
    ξ: "x",
    ο: "o",
    π: "p",
    ρ: "r",
    σ: "s",
    ς: "s",
    τ: "t",
    υ: "y",
    φ: "f",
    χ: "ch",
    ψ: "ps",
    ω: "o",
    Ά: "A",
    Έ: "E",
    Ή: "I",
    Ί: "I",
    Ό: "O",
    Ύ: "Y",
    Ώ: "O",
    ά: "a",
    έ: "e",
    ή: "i",
    ί: "i",
    ό: "o",
    ύ: "y",
    ώ: "o",
    Ϊ: "I",
    Ϋ: "Y",
    ϊ: "i",
    ϋ: "y",
    ΐ: "i",
    ΰ: "y",
  };

  return Array.from(input || "")
    .map((ch) => map[ch] ?? ch)
    .join("");
}

function safePart(v: string) {
  return transliterateGreek(String(v || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9.\-@_()]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Duplicate only when the FULL sanitized filename is identical.
 * So:
 * - Temperature_2-2026.xlsx !== Temperature_3-2026.xlsx
 * - exact same name === duplicate
 */
function normalizeFilenameForDedup(name: string) {
  return safePart(name || "").toLowerCase();
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
  keepStorageKey: string | null;
}) {
  const { assigneeId, keepFileId, keepOriginalName, keepStorageKey } = params;

  const dedupeKey = normalizeFilenameForDedup(keepOriginalName);
  if (!dedupeKey) return { deletedOldRecords: 0, duplicateCandidates: 0 };

  const existingAssignments = await prisma.fileAssignment.findMany({
    where: { userId: assigneeId },
    select: {
      fileId: true,
      file: {
        select: {
          id: true,
          originalName: true,
          url: true,
          createdAt: true,
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
    const dupStorageKey = extractStorageKeyFromDownloadUrl(dup.file.url);

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
      const shouldRemoveStorage =
        !!dupStorageKey &&
        !!keepStorageKey &&
        dupStorageKey !== keepStorageKey;

      if (shouldRemoveStorage) {
        try {
          await supabaseRemove([dupStorageKey]);
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

  return {
    deletedOldRecords,
    duplicateCandidates: duplicates.length,
  };
}

function buildDebugMeta(params: {
  stage: string;
  title?: string | null;
  safeName?: string | null;
  keyPath?: string | null;
  uploadedByEmail?: string | null;
  uploadedById?: string | null;
  assignerId?: string | null;
  candidates?: string[];
  assigneeIds?: string[];
  contentType?: string | null;
  size?: number | null;
  warning?: string | null;
  error?: string | null;
  extra?: Record<string, any>;
}) {
  return {
    via: "integration_multipart_ingest",
    stage: params.stage,
    title: params.title ?? null,
    originalName: params.safeName ?? null,
    storageKey: params.keyPath ?? null,
    uploadedByEmail: params.uploadedByEmail ?? null,
    uploadedById: params.uploadedById ?? null,
    assignerId: params.assignerId ?? null,
    candidates: params.candidates ?? [],
    assigneeIds: params.assigneeIds ?? [],
    mime: params.contentType ?? null,
    size: params.size ?? null,
    warning: params.warning ?? null,
    error: params.error ?? null,
    ...(params.extra || {}),
  };
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
        "multipart/form-data required",
        "Το DB record γράφεται μόνο αν το storage upload επιβεβαιωθεί",
        "Duplicate θεωρείται μόνο το ακριβώς ίδιο filename",
        "Διαφορετικός μήνας = διαφορετικό αρχείο",
        "Τα ελληνικά γίνονται transliteration ώστε το storage key να παραμένει σταθερό",
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
      {
        ok: false,
        error: "unsupported_media_type",
        hint: "Use multipart/form-data",
        debug: {
          stage: "content_type_check",
          receivedContentType: ct || null,
        },
      },
      { status: 415, headers: { "Cache-Control": "no-store" } }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_multipart",
        debug: {
          stage: "formdata_parse",
          detail: e?.message || "formData parse failed",
        },
      },
      { status: 400 }
    );
  }

  const title = String(form.get("title") || "").trim();
  const file = form.get("file") as File | null;
  const uploadedByEmail =
    (String(form.get("uploadedByEmail") || "").trim() || undefined) as string | undefined;

  if (!title || !file) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_fields",
        detail: "title and file are required",
        debug: {
          stage: "validate_required_fields",
          hasTitle: !!title,
          hasFile: !!file,
          uploadedByEmail: uploadedByEmail ?? null,
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const originalNameRaw = (file as any).name || `${title}.xlsx`;
  const safeName = safePart(originalNameRaw);

  const contentTypeRaw = (file.type || "").toLowerCase();
  const safeNameLower = safeName.toLowerCase();
  const contentType =
    contentTypeRaw ||
    (safeNameLower.endsWith(".pdf")
      ? "application/pdf"
      : "application/octet-stream");

  let buf: Buffer;
  try {
    const ab = await file.arrayBuffer();
    buf = Buffer.from(ab);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "file_read_failed",
        debug: {
          stage: "file_to_buffer",
          title,
          originalNameRaw,
          safeName,
          uploadedByEmail: uploadedByEmail ?? null,
          detail: e?.message || "arrayBuffer failed",
        },
      },
      { status: 500 }
    );
  }

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
      ...extractEmailsFromText(`${title} ${safeName}`),
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
    assigneeScope = safePart(candidates[0].toLowerCase());
  } else if (uploadedByEmail) {
    assigneeScope = safePart(uploadedByEmail.toLowerCase());
  }

  const keyPath = `uploads/${assigneeScope}__${safeName}`;

  try {
    await supabaseRemove([keyPath]);
  } catch {
    // ignore
  }

  try {
    await supabasePutBuffer(keyPath, buf, contentType);
  } catch (e: any) {
    await logAudit({
      action: "FILE_UPLOADED",
      target: "File",
      targetId: null,
      meta: buildDebugMeta({
        stage: "storage_upload_failed",
        title,
        safeName,
        keyPath,
        uploadedByEmail,
        uploadedById,
        assignerId,
        candidates,
        assigneeIds,
        contentType,
        size: buf.byteLength,
        error: e?.message || "upload_failed",
      }),
    }).catch(() => {});

    return NextResponse.json(
      {
        ok: false,
        error: "storage_upload_failed",
        detail: e?.message || "Upload failed",
        debug: {
          stage: "storage_upload_failed",
          title,
          originalNameRaw,
          safeName,
          keyPath,
          uploadedByEmail: uploadedByEmail ?? null,
          uploadedById: uploadedById ?? null,
          assignerId: assignerId ?? null,
          candidates,
          assigneeIds,
          contentType,
          size: buf.byteLength,
        },
      },
      { status: 500 }
    );
  }

  let uploadVerified = false;
  try {
    uploadVerified = await supabaseObjectExists(keyPath);
  } catch (e: any) {
    await logAudit({
      action: "FILE_UPLOADED",
      target: "File",
      targetId: null,
      meta: buildDebugMeta({
        stage: "storage_verify_failed",
        title,
        safeName,
        keyPath,
        uploadedByEmail,
        uploadedById,
        assignerId,
        candidates,
        assigneeIds,
        contentType,
        size: buf.byteLength,
        error: e?.message || "verify_failed",
      }),
    }).catch(() => {});

    return NextResponse.json(
      {
        ok: false,
        error: "storage_verify_failed",
        detail: e?.message || "Verification failed",
        debug: {
          stage: "storage_verify_failed",
          title,
          originalNameRaw,
          safeName,
          keyPath,
          uploadedByEmail: uploadedByEmail ?? null,
          uploadedById: uploadedById ?? null,
          assignerId: assignerId ?? null,
          candidates,
          assigneeIds,
          contentType,
          size: buf.byteLength,
        },
      },
      { status: 500 }
    );
  }

  if (!uploadVerified) {
    await logAudit({
      action: "FILE_UPLOADED",
      target: "File",
      targetId: null,
      meta: buildDebugMeta({
        stage: "storage_object_missing_after_upload",
        title,
        safeName,
        keyPath,
        uploadedByEmail,
        uploadedById,
        assignerId,
        candidates,
        assigneeIds,
        contentType,
        size: buf.byteLength,
      }),
    }).catch(() => {});

    return NextResponse.json(
      {
        ok: false,
        error: "storage_object_missing_after_upload",
        detail: "File was not found in storage after upload",
        debug: {
          stage: "storage_object_missing_after_upload",
          title,
          originalNameRaw,
          safeName,
          keyPath,
          uploadedByEmail: uploadedByEmail ?? null,
          uploadedById: uploadedById ?? null,
          assignerId: assignerId ?? null,
          candidates,
          assigneeIds,
          contentType,
          size: buf.byteLength,
        },
      },
      { status: 500 }
    );
  }

  const publicUrl = `/api/files/download/${keyPath}`;

  let record: {
    id: string;
    title: string;
    originalName: string | null;
    url: string | null;
    createdAt: Date;
  };

  try {
    record = await prisma.file.create({
      data: {
        title,
        originalName: safeName,
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
  } catch (e: any) {
    await logAudit({
      action: "FILE_UPLOADED",
      target: "File",
      targetId: null,
      meta: buildDebugMeta({
        stage: "db_create_failed",
        title,
        safeName,
        keyPath,
        uploadedByEmail,
        uploadedById,
        assignerId,
        candidates,
        assigneeIds,
        contentType,
        size: buf.byteLength,
        error: e?.message || "db_create_failed",
      }),
    }).catch(() => {});

    return NextResponse.json(
      {
        ok: false,
        error: "db_create_failed",
        detail: e?.message || "Database create failed",
        debug: {
          stage: "db_create_failed",
          title,
          originalNameRaw,
          safeName,
          keyPath,
          uploadedByEmail: uploadedByEmail ?? null,
          uploadedById: uploadedById ?? null,
          assignerId: assignerId ?? null,
          candidates,
          assigneeIds,
          contentType,
          size: buf.byteLength,
        },
      },
      { status: 500 }
    );
  }

  if (assigneeIds.length && assignerId) {
    try {
      await prisma.fileAssignment.createMany({
        data: assigneeIds.map((userId) => ({
          fileId: record.id,
          userId,
          assignedById: assignerId,
        })),
        skipDuplicates: true,
      });
      assignmentCreated = true;
    } catch (e: any) {
      warning = `assignment_failed: ${e?.message || "unknown error"}`;
    }
  } else {
    warning =
      assigneeIds.length === 0
        ? "No assignee resolved from filename/title/uploadedByEmail"
        : "No assignerId found";
  }

  let deletedOldRecords = 0;
  let duplicateCandidates = 0;

  if (assigneeIds.length) {
    for (const assigneeId of assigneeIds) {
      const dedupe = await dedupeForAssignee({
        assigneeId,
        keepFileId: record.id,
        keepOriginalName: record.originalName || "",
        keepStorageKey: keyPath,
      });
      deletedOldRecords += dedupe.deletedOldRecords;
      duplicateCandidates += dedupe.duplicateCandidates;
    }
  }

  await logAudit({
    action: "FILE_UPLOADED",
    target: "File",
    targetId: record.id,
    meta: buildDebugMeta({
      stage: "completed",
      title,
      safeName,
      keyPath,
      uploadedByEmail,
      uploadedById,
      assignerId,
      candidates,
      assigneeIds,
      contentType,
      size: buf.byteLength,
      warning,
      extra: {
        uploadVerified,
        assignmentCreated,
        deletedOldRecords,
        duplicateCandidates,
        fileId: record.id,
        publicUrl,
        originalNameRaw,
      },
    }),
  });

  return NextResponse.json(
    {
      ok: true,
      file: record,
      assignedCount: assigneeIds.length,
      assignmentCreated,
      uploadVerified,
      key: keyPath,
      replaced: true,
      deletedOldRecords,
      duplicateCandidates,
      warning,
      debug: {
        stage: "completed",
        title,
        originalNameRaw,
        safeName,
        keyPath,
        uploadedByEmail: uploadedByEmail ?? null,
        uploadedById: uploadedById ?? null,
        assignerId: assignerId ?? null,
        candidates,
        assigneeIds,
        contentType,
        size: buf.byteLength,
      },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}