// src/app/api/integrations/upload-multipart/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";
import { supabasePutBuffer, supabaseRemove } from "@/lib/storage-supabase";
import { logAudit } from "@/lib/audit";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";

export const runtime = "nodejs";

// (shared with uploads route) - find who "assigns" (admin if uploader isn't admin)
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

// -------- GET (scheduler / health / spec) --------
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
        file: "File (required, .xlsx from local disk)",
        uploadedByEmail: "string (optional, attribution if it matches a user)",
      },
      notes: [
        "Replace behavior: αν υπάρχει αρχείο με ίδιο filename, γίνεται overwrite στο storage.",
        "Ανάθεση: ανιχνεύουμε emails μέσα στο title/original filename/uploadedByEmail.",
        "Ασφάλεια: δεν διαγράφουμε παλιά DB records αν η νέα ανάθεση αποτύχει.",
      ],
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// -------- POST (multipart upload: title + file [+ uploadedByEmail]) --------
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
    return NextResponse.json(
      { ok: false, error: "invalid_multipart" },
      { status: 400 }
    );
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

  // 1) Read file bytes
  const originalNameRaw = (file as any).name || `${title}.xlsx`;
  const safeName = String(originalNameRaw).replace(/[^\w.\-@]+/g, "_");

  const contentTypeRaw = (file.type || "").toLowerCase();
  const safeNameLower = safeName.toLowerCase();
  const contentType =
    contentTypeRaw ||
    (safeNameLower.endsWith(".pdf")
      ? "application/pdf"
      : "application/octet-stream");

  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);

  // 2) Stable storage path = overwrite same filename
  const keyPath = `uploads/${safeName}`;
  const publicUrl = `/api/files/download/${keyPath}`;

  // 3) Storage overwrite
  try {
    await supabaseRemove([keyPath]);
  } catch {
    // ignore remove errors
  }

  const put = await supabasePutBuffer(keyPath, buf, contentType);

  // 4) Work out attribution
  let uploadedById: string | undefined;
  if (uploadedByEmail) {
    const u = await prisma.user.findUnique({
      where: { email: uploadedByEmail },
      select: { id: true },
    });
    uploadedById = u?.id;
  }

  const assignerId = await getAssignerId(uploadedById);

  // 5) Resolve assignees BEFORE deleting any old DB rows
  const candidates = Array.from(
    new Set([
      ...extractEmailsFromText(`${title} ${safeName}`),
      ...(uploadedByEmail ? [uploadedByEmail] : []),
    ])
  );

  const assigneeIds = candidates.length
    ? await resolveAssigneeIdsByEmails(candidates)
    : [];

  // Keep old records for this storage path in case new assignment fails
  const oldFiles = await prisma.file.findMany({
    where: { url: publicUrl },
    select: { id: true, url: true, originalName: true },
  });

  // 6) Create new file record
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

  let assignmentCreated = false;

  // 7) Create assignments if possible
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
  }

  // 8) Delete old duplicate DB rows ONLY if new file was assigned successfully
  let deletedOldRecords = 0;

  if (assignmentCreated) {
    for (const oldFile of oldFiles) {
      await prisma.file.delete({
        where: { id: oldFile.id },
      });
      deletedOldRecords++;
    }
  }

  // 9) Audit
  await logAudit({
    action: "FILE_UPLOADED",
    target: "File",
    targetId: record.id,
    meta: {
      via: "integration_multipart_ingest",
      storageKey: keyPath,
      mime: contentType,
      size: buf.byteLength,
      emails: candidates,
      assigned: assigneeIds.length,
      assignerId,
      assignmentCreated,
      replacedStorage: true,
      deletedOldRecords,
      oldRecordIds: oldFiles.map((f) => f.id),
      warning:
        assignmentCreated
          ? null
          : "Το αρχείο ανέβηκε αλλά δεν δημιουργήθηκε νέα ανάθεση. Τα παλιά records δεν διαγράφηκαν.",
    },
  });

  return NextResponse.json(
    {
      ok: true,
      file: record,
      assignedCount: assigneeIds.length,
      key: keyPath,
      signedUrl: put.signedUrl,
      replaced: true,
      assignmentCreated,
      deletedOldRecords,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}