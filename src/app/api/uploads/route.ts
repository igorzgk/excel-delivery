import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { logAudit } from "@/lib/audit";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";

export const runtime = "nodejs"; // needed for file IO

export async function POST(req: Request) {
  // Admin-only
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 400 });
  }

  const form = await req.formData();

  // The <input name="file" type="file" />
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "missing_file" }, { status: 400 });

  // Optional <input name="title" />
  const titleFromForm = (form.get("title") as string) || "";

  // ---- Save the file to disk ------------------------------------------
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "uploads"); // served via your rewrite/proxy
  await mkdir(uploadDir, { recursive: true });

  const safeBase = (file.name || "file").replace(/[^\w.\-@]/g, "_");
  const filename = `${Date.now()}-${safeBase}`;
  const fullPath = path.join(uploadDir, filename);
  await writeFile(fullPath, buffer);

  const publicUrl = `/uploads/${filename}`; // what we store in DB and render in UI

  // ---- Create DB record ------------------------------------------------
  const record = await prisma.file.create({
    data: {
      title: titleFromForm || file.name || "Untitled",
      originalName: file.name,
      mime: file.type,
      size: buffer.length,
      uploadedById: (guard.user as any).id,
      url: publicUrl,
    },
    select: { id: true, title: true, originalName: true, url: true, createdAt: true },
  });

  // ---- Targeted auto-assignment from filename/title/url ----------------
  // Extract candidate emails from any available text
  const candidates = Array.from(
    new Set([
      ...extractEmailsFromText(record.originalName),
      ...extractEmailsFromText(record.title),
      ...extractEmailsFromText(record.url),
    ])
  );

  // Match only ACTIVE USERs
  const assigneeIds = await resolveAssigneeIdsByEmails(candidates);

  // Create assignments (assignedBy = current admin)
  let assignedCount = 0;
  if (assigneeIds.length > 0) {
    await prisma.fileAssignment.createMany({
      data: assigneeIds.map((userId) => ({
        fileId: record.id,
        userId,
        assignedById: (guard.user as any).id,
        note: "Auto-assigned via filename email (manual upload)",
      })),
      skipDuplicates: true,
    });
    assignedCount = assigneeIds.length;

    await logAudit({
      actorId: (guard.user as any).id,
      action: "FILE_ASSIGNED",
      targetId: record.id,
      target: "File",
      meta: {
        via: "admin_manual_upload",
        strategy: "emails_in_filename",
        emails: candidates,
        matched: assigneeIds.length,
      },
    });
  } else {
    // Log that no matches were found (still successful upload)
    await logAudit({
      actorId: (guard.user as any).id,
      action: "FILE_ASSIGNED",
      targetId: record.id,
      target: "File",
      meta: {
        via: "admin_manual_upload",
        strategy: "emails_in_filename",
        emails: candidates,
        matched: 0,
        note: "No assignees matched",
      },
    });
  }

  // ---- Audit the upload itself ----------------------------------------
  await logAudit({
    actorId: (guard.user as any).id,
    action: "FILE_UPLOADED",
    targetId: record.id,
    target: "File",
    meta: {
      title: record.title,
      originalName: record.originalName,
      size: buffer.length,
      mime: file.type,
      via: "admin_manual_upload",
      url: publicUrl,
    },
  });

  return NextResponse.json(
    { ok: true, file: record, assignments: assignedCount, matchedEmails: candidates },
    { status: 201 }
  );
}
