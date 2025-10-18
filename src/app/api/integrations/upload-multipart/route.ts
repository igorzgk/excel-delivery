// src/app/api/integrations/upload-multipart/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";
import { supabasePutBuffer } from "@/lib/storage-supabase";
import { logAudit } from "@/lib/audit";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";

export const runtime = "nodejs";

const ALLOWED_EXT = new Set([".xlsx", ".xlsm", ".xls"]);
const MIME_TO_EXT: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel.sheet.macroEnabled.12": ".xlsm",
  "application/vnd.ms-excel": ".xls",
};
const MAX_BYTES = 50 * 1024 * 1024;

function pickExtFromName(name?: string | null) {
  if (!name) return null;
  const m = /\.[A-Za-z0-9]+$/.exec(name);
  return m ? m[0].toLowerCase() : null;
}

async function getAssignerId(uploadedById?: string | null) {
  if (uploadedById) {
    const u = await prisma.user.findUnique({ where: { id: uploadedById }, select: { role: true } });
    if (u?.role === "ADMIN") return uploadedById;
  }
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  return admin?.id ?? null;
}

export async function POST(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  const form = await req.formData();
  const file = form.get("file") as unknown as File | null;
  const title = String(form.get("title") || "");
  const uploadedByEmail = form.get("uploadedByEmail") ? String(form.get("uploadedByEmail")) : undefined;

  if (!file) {
    return NextResponse.json({ error: "No file provided (form-data key 'file' missing or not a File)" }, { status: 400 });
  }

  const rawName = (file as any).name as string | undefined; // may be "blob"
  const contentType = ((file as any).type as string | undefined) || "application/octet-stream";

  let ext = pickExtFromName(rawName);
  if (!ext || !ALLOWED_EXT.has(ext)) {
    const mimeExt = MIME_TO_EXT[contentType];
    if (mimeExt && ALLOWED_EXT.has(mimeExt)) ext = mimeExt;
  }
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: "Unsupported file type", details: { rawName, contentType } }, { status: 415 });
  }

  // Size guard
  // @ts-ignore
  const declaredSize = (file as any).size as number | undefined;
  const ab = await file.arrayBuffer();
  if ((declaredSize ?? ab.byteLength) > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (> ${Math.floor(MAX_BYTES / (1024 * 1024))} MB)` }, { status: 413 });
  }

  const buf = Buffer.from(ab);
  const safeBase = (rawName && rawName !== "blob" ? rawName : `upload${ext}`).replace(/[^\w.\-@]+/g, "_");

  // Upload to Supabase
  const now = new Date();
  const keyPath = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${Date.now()}_${safeBase}`;
  const effType =
    contentType !== "application/octet-stream"
      ? contentType
      : ext === ".xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : ext === ".xlsm"
      ? "application/vnd.ms-excel.sheet.macroEnabled.12"
      : "application/vnd.ms-excel";

  const put = await supabasePutBuffer(keyPath, buf, effType);

  // Attribution
  let uploadedById: string | undefined;
  if (uploadedByEmail) {
    const u = await prisma.user.findUnique({ where: { email: uploadedByEmail }, select: { id: true } });
    uploadedById = u?.id;
  }
  const assignerId = await getAssignerId(uploadedById);

  // Create DB file row (dashboard reads this)
  const publicUrl = `/api/files/download/${keyPath}`;
  const record = await prisma.file.create({
    data: {
      title: title || safeBase,
      originalName: rawName || safeBase,
      url: publicUrl,                      // <- important
      mime: effType,
      size: buf.byteLength,
      uploadedById,
    },
    select: { id: true, title: true, originalName: true, url: true, createdAt: true },
  });

  // Auto-assign based on emails in filename/title
  const candidates = extractEmailsFromText(`${record.originalName} ${record.title}`);
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

  // Audit
  await logAudit({
    action: "FILE_UPLOADED",
    target: "File",
    targetId: record.id,
    meta: {
      via: "integration_multipart",
      storageKey: keyPath,
      mime: effType,
      size: buf.byteLength,
      assigned: assigneeIds.length,
      emails: candidates,
    },
  });

  return NextResponse.json({
    ok: true,
    file: record,
    assignedCount: assigneeIds.length,
    key: keyPath,
    signedUrl: put.signedUrl,
  }, { status: 201 });
}
