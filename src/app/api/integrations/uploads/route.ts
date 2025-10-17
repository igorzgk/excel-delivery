// src/app/api/integrations/uploads/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth"; // <-- changed
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";
import { supabasePutBuffer } from "@/lib/storage-supabase";
import { checkExt, MAX_BYTES } from "@/lib/files-validate";

const BodySchema = z.object({
  title: z.string().optional(),
  url: z.string().url(),
  originalName: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, url, originalName } = body;
  const name = originalName || title || "upload.xlsx";
  try { checkExt(name); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 415 }); }

  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) return NextResponse.json({ error: `Fetch failed (${r.status})` }, { status: 400 });

  const contentType = r.headers.get("content-type") || "application/octet-stream";
  const ab = await r.arrayBuffer();
  if (ab.byteLength > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });
  const buf = Buffer.from(ab);

  const now = new Date();
  const keyPath = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2, "0")}/${Date.now()}_${name}`;
  const put = await supabasePutBuffer(keyPath, buf, contentType);

  // OPTIONAL: auto-assign via filename emails
  const emails = extractEmailsFromText(name);
  const assignees = emails.length ? await resolveAssigneeIdsByEmails(emails) : [];

  // Save DB record (adjust to your schema)
  const file = await prisma.file.create({
    data: {
      title: title || name,
      originalName: name,
      storageKey: keyPath,
      contentType,
      size: buf.byteLength,
      // any other fields...
      assignments: assignees.length
        ? { createMany: { data: assignees.map((userId) => ({ userId })) } }
        : undefined,
    },
  });

  await logAudit({
    action: "file.uploaded_via_url",
    target: "file",
    targetId: file.id,
    meta: { url, name, keyPath, emails, assignedCount: assignees.length },
  });

  return NextResponse.json({
    ok: true,
    file: {
      id: file.id,
      title: file.title,
      originalName: file.originalName,
      contentType,
      size: buf.byteLength,
      key: put.key,
      signedUrl: put.signedUrl,
      assignedCount: assignees.length,
    },
  });
}
