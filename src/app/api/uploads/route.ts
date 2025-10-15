import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs"; // required for file writes (not edge)

export async function POST(req: Request) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "missing_file" }, { status: 400 });

  const title = (form.get("title") as string) || file.name;
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "uploads");

  await mkdir(uploadDir, { recursive: true });
  const filename = `${Date.now()}-${file.name}`;
  const fullPath = path.join(uploadDir, filename);
  await writeFile(fullPath, buffer);

  const record = await prisma.file.create({
    data: {
      title,
      originalName: file.name,
      mime: file.type,
      size: buffer.length,
      uploadedById: (guard.user as any).id,
      url: `/uploads/${filename}`,
    },
  });

  await logAudit({
    actorId: (guard.user as any).id,
    action: "FILE_UPLOADED",
    targetId: record.id,
    target: "File",
    meta: { title, mime: file.type, size: buffer.length, path: record.url },
  });

  return NextResponse.json({ ok: true, file: record }, { status: 201 });
}
