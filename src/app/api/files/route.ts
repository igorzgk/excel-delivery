// src/app/api/files/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser, requireRole } from "@/lib/auth-helpers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "Files"; // <-- your existing bucket (private)

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

function safeFilename(name: string) {
  return (name || "file").replace(/[^\w.\-() ]+/g, "_");
}

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope"); // "all" for admin view, otherwise user's files
  const isAdmin = (me as any).role === "ADMIN" && scope === "all";

  const where = isAdmin
    ? undefined
    : {
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

      // ✅ IMPORTANT: this is what your UI needs to persist "move to folder"
      pdfFolderId: true,

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

  return NextResponse.json(
    { files },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

// Admin manual upload from /admin/files
export async function POST(req: Request) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  try {
    const form = await req.formData();

    const title = String(form.get("title") || "").trim();
    const file = form.get("file") as File | null;
    const assignTo = String(form.get("assignTo") || "").trim(); // <-- from your Admin UI

    if (!title || !file) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // ✅ PDF detection fix (even if browser sends empty type)
    const originalName = safeFilename(file.name || "file");
    const lower = originalName.toLowerCase();
    const contentTypeRaw = (file as any).type || "";
    const mime =
      contentTypeRaw ||
      (lower.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");

    // Convert to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Create a storage key (no folders -> easy route param)
    const ext = lower.includes(".") ? lower.split(".").pop() : "";
    const key = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

    // Upload to Supabase (private bucket)
    const supabase = supabaseAdmin();
    const up = await supabase.storage.from(BUCKET).upload(key, buffer, {
      contentType: mime,
      upsert: false,
    });

    if (up.error) {
      console.error(up.error);
      return NextResponse.json(
        { error: "upload_failed", detail: up.error.message },
        { status: 500 }
      );
    }

    // ✅ Store url as your internal download route (works with private bucket)
    const url = `/api/files/download/${encodeURIComponent(key)}`;

    // ✅ create file record with mime + originalName + uploadedBy
    const created = await prisma.file.create({
      data: {
        title,
        originalName,
        url,
        mime,
        size: buffer.length,
        uploadedById: (guard as any)?.userId || null, // if your requireRole returns userId
      },
      select: { id: true },
    });

    // ✅ assignment if selected
    if (assignTo) {
      // who is doing the assignment (admin)
      const me = await currentUser();
      if (!me) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

      await prisma.fileAssignment.create({
        data: {
          file: { connect: { id: created.id } },
          user: { connect: { id: assignTo } },
          assignedBy: { connect: { id: (me as any).id } }, // ✅ REQUIRED by your schema
        },
      });
    }

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "server_error", detail: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}