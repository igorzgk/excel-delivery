// src/app/api/integrations/uploads/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";
import { supabasePutBuffer } from "@/lib/storage-supabase";
import { logAudit } from "@/lib/audit";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  title: z.string().optional(),
  url: z.string().url(),                   // public URL to fetch from
  originalName: z.string().optional(),     // e.g. orders_john@doe.com.xlsx
  uploadedByEmail: z.string().email().optional(),
});

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

  let data: z.infer<typeof BodySchema>;
  try { data = BodySchema.parse(await req.json()); }
  catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }

  // 1) Download the file bytes
  const r = await fetch(data.url, { redirect: "follow" });
  if (!r.ok) return NextResponse.json({ error: `Fetch failed (${r.status})` }, { status: 400 });
  const contentType = r.headers.get("content-type") || "application/octet-stream";
  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);

  // 2) Store in Supabase Storage
  const now = new Date();
  const safeName = (data.originalName || data.title || "upload.xlsx").replace(/[^\w.\-@]+/g, "_");
  const keyPath = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${Date.now()}_${safeName}`;
  const put = await supabasePutBuffer(keyPath, buf, contentType);

  // 3) Work out attribution (who uploaded & who assigns)
  let uploadedById: string | undefined;
  if (data.uploadedByEmail) {
    const u = await prisma.user.findUnique({ where: { email: data.uploadedByEmail }, select: { id: true } });
    uploadedById = u?.id;
  }
  const assignerId = await getAssignerId(uploadedById);

  // 4) Create DB record (THIS is what the dashboard reads)
  const publicUrl = `/api/files/download/${keyPath}`; // signed on demand
  const record = await prisma.file.create({
    data: {
      title: data.title || safeName,
      originalName: data.originalName || safeName,
      url: publicUrl,                      // <- dashboard uses this
      mime: contentType,
      size: buf.byteLength,
      uploadedById,
    },
    select: { id: true, title: true, originalName: true, url: true, createdAt: true },
  });

  // 5) Auto-assign by emails in filename/title (optional)
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

  // 6) Audit
  await logAudit({
    action: "FILE_UPLOADED",
    target: "File",
    targetId: record.id,
    meta: {
      via: "integration_url_ingest",
      sourceUrl: data.url,
      storageKey: keyPath,
      mime: contentType,
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
