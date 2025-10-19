// src/app/api/uploads/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";
import { supabasePutBuffer } from "@/lib/storage-supabase";

// No filesystem usage → works on Vercel
export const runtime = "nodejs";

export async function POST(req: Request) {
  // Admin-only
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  // ✅ Guard: multipart only
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "invalid_content_type", expected: "multipart/form-data" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file") as unknown as File | null;
  const title = (form.get("title") as string | null) ?? undefined;

  if (!file) return NextResponse.json({ error: "file_missing" }, { status: 400 });

  const rawName = (file as any).name as string | undefined;
  const mime = ((file as any).type as string | undefined) || "application/octet-stream";
  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);

  const safeBase = (title || rawName || "upload.xlsx").replace(/[^\w.\-@]+/g, "_").slice(0, 100);
  const now = new Date();
  const keyPath = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${Date.now()}_${safeBase}`;

  // Store in Supabase Storage
  const put = await supabasePutBuffer(keyPath, buf, mime);

  // Create DB record
  const publicUrl = `/api/files/download/${keyPath}`; // signed on demand
  const record = await prisma.file.create({
    data: {
      title: title || safeBase,
      originalName: rawName || safeBase,
      url: publicUrl,
      mime,
      size: buf.byteLength,
      uploadedById: (guard.user as any).id,
    },
    select: { id: true, title: true, originalName: true, url: true, createdAt: true },
  });

  // Optional: auto-assign based on emails in the filename/title
  const candidates = extractEmailsFromText(`${record.originalName} ${record.title}`);
  const assigneeIds = candidates.length ? await resolveAssigneeIdsByEmails(candidates) : [];
  if (assigneeIds.length) {
    await prisma.fileAssignment.createMany({
      data: assigneeIds.map((userId) => ({
        fileId: record.id,
        userId,
        assignedById: (guard.user as any).id,
      })),
      skipDuplicates: true,
    });
  }

  await logAudit({
    action: "FILE_UPLOADED",
    target: "File",
    targetId: record.id,
    actorId: (guard.user as any).id,
    meta: { via: "admin", storageKey: keyPath, mime, size: buf.byteLength, assigned: assigneeIds.length, emails: candidates },
  });

  return NextResponse.json({ ok: true, file: record, key: keyPath, signedUrl: put.signedUrl, assignedCount: assigneeIds.length }, { status: 201 });
}
