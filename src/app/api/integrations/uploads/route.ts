import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/apiKeyAuth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const JsonSchema = z.object({
  title: z.string().min(1).default("Untitled"),
  url: z.string().min(1).optional(),            // allow any string (not enforcing http URL)
  originalName: z.string().optional(),
  mime: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  uploadedByEmail: z.string().email().optional(),
});

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  const key = await verifyApiKey(apiKey);
  if (!key) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });

  // Accept JSON or multipart/form-data
  const ctype = req.headers.get("content-type") || "";
  let payload: any = {};
  try {
    if (ctype.includes("application/json")) {
      payload = await req.json();
    } else if (ctype.includes("multipart/form-data")) {
      const fd = await req.formData();
      payload = Object.fromEntries(fd.entries());
      if (payload.size != null) payload.size = Number(payload.size);
    } else {
      return NextResponse.json({ error: "unsupported_content_type", contentType: ctype }, { status: 400 });
    }
  } catch (err) {
    console.warn("[uploads] parse error:", err);
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  // Validate & normalize
  const data = JsonSchema.safeParse(payload);
  if (!data.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: data.error.flatten() },
      { status: 400 }
    );
  }
  const body = data.data;

  // Optional attribution
  let uploadedById: string | undefined;
  if (body.uploadedByEmail) {
    const u = await prisma.user.findUnique({ where: { email: body.uploadedByEmail } });
    uploadedById = u?.id;
  }

  const file = await prisma.file.create({
    data: {
      title: body.title || "Untitled",
      url: body.url,
      originalName: body.originalName,
      mime: body.mime,
      size: body.size,
      uploadedById,
    },
    select: { id: true, title: true, createdAt: true, uploadedById: true },
  });

  try {
    await logAudit({
      actorId: uploadedById ?? null,
      action: "FILE_UPLOADED",
      targetId: file.id,
      target: "File",
      meta: {
        via: "integration",
        apiKeyId: key.id,
        title: body.title,
        mime: body.mime,
        size: body.size ?? null,
        uploadedByEmail: body.uploadedByEmail ?? null,
      },
    });
    console.log("[AUDIT] FILE_UPLOADED", file.id);
  } catch (e) {
    console.warn("[AUDIT] failed:", e);
  }

  return NextResponse.json({ ok: true, file }, { status: 201 });
}
