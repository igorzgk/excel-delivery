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

function safePart(v: string) {
  return String(v || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9.\-@_()]+/g, "_")
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
        "Το storage path είναι scoped ανά assignee μέσα στο filename.",
        "Πριν γραφτεί DB record γίνεται verify ότι το object υπάρχει όντως στο storage.",
        "Αν το upload δεν επιβεβαιωθεί, επιστρέφει 500 και ΔΕΝ δημιουργείται phantom DB record.",
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
  const safeName = safePart(originalNameRaw);

  const contentTypeRaw = (file.type || "").toLowerCase();
  const safeNameLower = safeName.toLowerCase();
  const contentType =
    contentTypeRaw ||
    (safeNameLower.endsWith(".pdf")
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

  // 1) upload to storage
  try {
    await supabasePutBuffer(keyPath, buf, contentType);
  } catch (e: any) {
    await logAudit({
      action: "FILE_UPLOADED",
      target: "File",
      targetId: null,
      meta: {
        via: "integration_multipart_ingest",
        stage: "upload_failed",
        keyPath,
        title,
        originalName: safeName,
        uploadedByEmail: uploadedByEmail ?? null,
        error: e?.message || "upload_failed",
      },
    }).catch(() => {});

    return NextResponse.json(
      {
        ok: false,
        error: "storage_upload_failed",
        detail: e?.message || "Upload failed",
        key: keyPath,
      },
      { status: 500 }
    );
  }

  // 2) verify object really exists BEFORE db write
  let uploadVerified = false;
  try {
    uploadVerified = await supabaseObjectExists(keyPath);
  } catch (e: any) {
    await logAudit({
      action: "FILE_UPLOADED",
      target: "File",
      targetId: null,
      meta: {
        via: "integration_multipart_ingest",
        stage: "verify_failed",
        keyPath,
        title,
        originalName: safeName,
        uploadedByEmail: uploadedByEmail ?? null,
        error: e?.message || "verify_failed",
      },
    }).catch(() => {});

    return NextResponse.json(
      {
        ok: false,
        error: "storage_verify_failed",
        detail: e?.message || "Verification failed",
        key: keyPath,
      },
      { status: 500 }
    );
  }

  if (!uploadVerified) {
    await logAudit({
      action: "FILE_UPLOADED",
      target: "File",
      targetId: null,
      meta: {
        via: "integration_multipart_ingest",
        stage: "verify_missing_after_upload",
        keyPath,
        title,
        originalName: safeName,
        uploadedByEmail: uploadedByEmail ?? null,
      },
    }).catch(() => {});

    return NextResponse.json(
      {
        ok: false,
        error: "storage_object_missing_after_upload",
        detail: "File was not found in storage after upload",
        key: keyPath,
      },
      { status: 500 }
    );
  }

  // 3) create db record only after verified upload
  const publicUrl = `/api/files/download/${keyPath}`;

  const record = await prisma.file.create({
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

  // 4) assignments
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
        ? "No assignee resolved from filename/title/uploadedByEmail"
        : "No assignerId found";
  }

  // 5) dedupe
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

  // 6) audit
  await logAudit({
    action: "FILE_UPLOADED",
    target: "File",
    targetId: record.id,
    meta: {
      via: "integration_multipart_ingest",
      stage: "completed",
      mime: contentType,
      size: buf.byteLength,
      emails: candidates,
      warning,
      assigned: assigneeIds.length,
      assignmentCreated,
      assignerId,
      storageKey: keyPath,
      uploadVerified,
      replaced: true,
      deletedOldRecords,
      fileId: record.id,
      title,
      originalName: safeName,
      assigneeScope,
    },
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
      warning,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}