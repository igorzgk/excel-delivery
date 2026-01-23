// src/app/api/files/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser, requireRole } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope"); // "all" for admin view, otherwise user's files
  const isAdmin = (me as any).role === "ADMIN" && scope === "all";

  const where = isAdmin
    ? undefined
    : {
        // for users: show uploads they made OR assignments to them
        OR: [
          { uploadedById: (me as any).id },
          { assignments: { some: { userId: (me as any).id } } },
        ],
      };

  const files = await prisma.file.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      originalName: true,
      url: true,
      mime: true,
      size: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      ...(isAdmin
        ? {
            assignments: {
              select: { user: { select: { id: true, email: true, name: true } } },
            },
          }
        : {}),
    },
  });

  return NextResponse.json({ files });
}

// Admin-only manual create (rarely used; your UIs mostly use POST /api/uploads)
export async function POST(req: Request) {
  // If you already guard admin here, keep it. If not, add your guard.
  // const guard = await requireRole("ADMIN"); ...

  const form = await req.formData();

  const title = String(form.get("title") || "").trim();
  const file = form.get("file") as File | null;
  const assignTo = String(form.get("assignTo") || "").trim(); // <-- IMPORTANT

  if (!title || !file) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // 🔥 PDF detection fix
  const safeName = (file.name || "file").replace(/[^\w.\-() ]+/g, "_");
  const contentTypeRaw = (file as any).type || "";
  const safeNameLower = safeName.toLowerCase();
  const contentType =
    contentTypeRaw ||
    (safeNameLower.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");

  // convert to Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // TODO: your storage upload logic here (S3/Supabase/local) should return a URL/key
  // I assume you already have it as `url`:
  const url = await uploadSomewhereAndReturnUrl(buffer, safeName, contentType); // <-- keep your existing code

  // ✅ create file record with mime + originalName
  const created = await prisma.file.create({
    data: {
      title,
      originalName: safeName,
      url,
      mime: contentType, // <-- IMPORTANT for PDF column
      size: buffer.length,
    },
    select: { id: true },
  });

  // ✅ assignment if selected
  if (assignTo) {
    await prisma.fileAssignment.create({
      data: { fileId: created.id, userId: assignTo },
    });
  }

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}

