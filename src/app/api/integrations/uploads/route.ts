// src/app/api/integrations/uploads/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/apiKeyAuth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";

const JsonSchema = z.object({
  title: z.string().min(1).default("Untitled"),
  url: z.string().min(1).optional(),
  originalName: z.string().optional(),
  mime: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  uploadedByEmail: z.string().email().optional(),
});

async function getAssignerId(uploadedById?: string | null) {
  // If the uploader is an ADMIN, use them as assigner; else fallback to first ACTIVE admin.
  if (uploadedById) {
    const u = await prisma.user.findUnique({ where: { id: uploadedById }, select: { role: true } });
    if (u?.role === "ADMIN") return uploadedById;
  }
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  return admin?.id ?? null;
}

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  const key = await verifyApiKey(apiKey);
  if (!key) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });

  // Parse + validate
  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }
  const parsed = JsonSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  // Optional attribution (who uploaded)
  let uploadedById: string | undefined;
  if (body.uploadedByEmail) {
    const u = await prisma.user.findUnique({ where: { email: body.uploadedByEmail }, select: { id: true } });
    uploadedById = u?.id;
  }

  // 1) Create the File record
  const file = await prisma.file.create({
    data: {
      title: body.title,
      url: body.url,
      originalName: body.originalName,
      mime: body.mime,
      size: body.size,
      uploadedById,
    },
    select: { id: true, title: true, createdAt: true, uploadedById: true },
  });

  // 2) Extract target emails (from filename/title/url)
  const candidates = Array.from(new Set([
    ...extractEmailsFromText(body.originalName),
    ...extractEmailsFromText(body.title),
    ...extractEmailsFromText(body.url),
  ]));

  const assigneeIds = await resolveAssigneeIdsByEmails(candidates);

  // 3) Determine assigner (admin)
  const assignedById = await getAssignerId(uploadedById);

  // 4) Create assignments if we found any matching users
  let assignedCount = 0;
  if (assignedById && assigneeIds.length > 0) {
    await prisma.fileAssignment.createMany({
      data: assigneeIds.map(userId => ({
        fileId: file.id,
        userId,
        assignedById,
        note: "Auto-assigned via filename email",
      })),
      skipDuplicates: true,
    });
    assignedCount = assigneeIds.length;

    await logAudit({
      actorId: assignedById,
      action: "FILE_ASSIGNED",
      targetId: file.id,
      target: "File",
      meta: { via: "integration", strategy: "emails_in_filename", emails: candidates, matched: assigneeIds.length },
    });
  } else {
    // no matches — log that info (we still succeed the upload)
    await logAudit({
      actorId: uploadedById ?? null,
      action: "FILE_ASSIGNED",
      targetId: file.id,
      target: "File",
      meta: { via: "integration", strategy: "emails_in_filename", emails: candidates, matched: 0, note: "No assignees matched" },
    });
  }

  // 5) Audit the upload itself
  await logAudit({
    actorId: uploadedById ?? null,
    action: "FILE_UPLOADED",
    targetId: file.id,
    target: "File",
    meta: { via: "integration", apiKeyId: key.id, title: body.title, originalName: body.originalName ?? null },
  });

  return NextResponse.json({ ok: true, file, assignments: assignedCount, matchedEmails: candidates }, { status: 201 });
}
