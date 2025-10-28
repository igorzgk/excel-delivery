// src/app/api/integrations/upload-multipart/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";
import { supabasePutBuffer } from "@/lib/storage-supabase";
import { logAudit } from "@/lib/audit";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";

export const runtime = "nodejs";

// (shared with uploads route) - find who "assigns" (admin if uploader isn't admin)
async function getAssignerId(uploadedById?: string | null) {
  if (uploadedById) {
    const u = await prisma.user.findUnique({ where: { id: uploadedById }, select: { role: true } });
    if (u?.role === "ADMIN") return uploadedById;
  }
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
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
        // Content-Type το ορίζει αυτόματα ο client για multipart (boundary)
      },
      expectsBody: {
        // multipart/form-data fields:
        title: "string (required)",
        file: "File (required, .xlsx from local disk)",
        uploadedByEmail: "string (optional, attribution if it matches a user)",
      },
      notes: [
        "Ανάθεση: ανιχνεύουμε emails μέσα στο title (και σε άλλα flows στο url).",
        "ΜΗΝ βάζετε email στο URL path (privacy/logging).",
        "Πάντα JSON responses (όχι HTML/redirect).",
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
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const title = String(form.get("title") || "").trim();
  const file = form.get("file") as File | null;
  const uploadedByEmail = (String(form.get("uploadedByEmail") || "").trim() || undefined) as
    | string
    | undefined;

  if (!title || !file) {
    return NextResponse.json(
      { ok: false, error: "missing_fields", detail: "title and file are required" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 1) Read file bytes
  const contentType = file.type || "application/octet-stream";
  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);

  // 2) Store in Supabase Storage
  const now = new Date();
  // Prefer original filename if present, otherwise derive from title
  const originalNameRaw = (file as any).name || `${title}.xlsx`;
  const safeName = String(originalNameRaw).replace(/[^\w.\-@]+/g, "_");
  const keyPath = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${Date.now()}_${safeName}`;
  const put = await supabasePutBuffer(keyPath, buf, contentType);

  // 3) Attribution who uploaded & who assigns
  let uploadedById: string | undefined;
  if (uploadedByEmail) {
    const u = await prisma.user.findUnique({ where: { email: uploadedByEmail }, select: { id: true } });
    uploadedById = u?.id;
  }
  const assignerId = await getAssignerId(uploadedById);

  // 4) Create DB record (this is what the app reads)
  const publicUrl = `/api/files/download/${keyPath}`; // signed on demand
  const record = await prisma.file.create({
    data: {
      title,                             // explicit title from form
      originalName: safeName,            // original filename (sanitized)
      url: publicUrl,                    // app uses this
      mime: contentType,
      size: buf.byteLength,
      uploadedById,
    },
    select: { id: true, title: true, originalName: true, url: true, createdAt: true },
  });

    // 5) Auto-assign by emails found in title/original filename + uploadedByEmail
  const candidates = Array.from(new Set([
    ...extractEmailsFromText(`${title} ${safeName}`),
    ...(uploadedByEmail ? [uploadedByEmail] : []), // <- include uploader
  ]));

  const assigneeIds = candidates.length ? await resolveAssigneeIdsByEmails(candidates) : [];
  if (assigneeIds.length && assignerId) {
    await prisma.fileAssignment.createMany({
      data: assigneeIds.map((userId) => ({
        fileId: record.id,
        userId,
        assignedById: assignerId,
      })),
      skipDuplicates: true,
    });
  }


  // 6) Audit log
  await logAudit({
    action: "FILE_UPLOADED",
    target: "File",
    targetId: record.id,
    meta: {
      via: "integration_multipart_ingest",
      storageKey: keyPath,
      mime: contentType,
      size: buf.byteLength,
      assigned: assigneeIds.length,
      emails: candidates,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      file: record,
      assignedCount: assigneeIds.length,
      key: keyPath,
      signedUrl: put.signedUrl,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
