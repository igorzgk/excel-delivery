// src/app/api/files/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth-helpers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY!;
const BUCKET = process.env.SUPABASE_BUCKET || "Files";

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
  if (!me) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
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
      pdfFolderId: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      ...(isAdmin
        ? {
            assignments: {
              select: {
                user: { select: { id: true, email: true, name: true } },
              },
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

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const isAdmin = (me as any).role === "ADMIN";

  try {
    const form = await req.formData();

    const title = String(form.get("title") || "").trim();
    const file = form.get("file") as File | null;
    const assignToRaw = String(form.get("assignTo") || "").trim();

    if (!title || !file) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    // non-admin users can only upload to themselves
    const assignTo = isAdmin ? assignToRaw : (me as any).id;

    const originalName = safeFilename(file.name || "file");
    const lower = originalName.toLowerCase();
    const contentTypeRaw = (file as any).type || "";
    const mime =
      contentTypeRaw ||
      (lower.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");

    const buffer = Buffer.from(await file.arrayBuffer());

    // Keep uploads simple and flat
    const ext = lower.includes(".") ? lower.split(".").pop() : "";
    const key = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

    const supabase = supabaseAdmin();
    const up = await supabase.storage.from(BUCKET).upload(key, buffer, {
      contentType: mime,
      upsert: false,
    });

    if (up.error) {
      console.error(up.error);
      return NextResponse.json(
        {
          error: "upload_failed",
          detail: up.error.message,
          bucket: BUCKET,
          supabaseUrl: SUPABASE_URL,
        },
        { status: 500 }
      );
    }

    const url = `/api/files/download/${encodeURIComponent(key)}`;

    const created = await prisma.file.create({
      data: {
        title,
        originalName,
        url,
        mime,
        size: buffer.length,
        uploadedById: (me as any).id,
      },
      select: { id: true },
    });

    // admin: optional assignment to chosen user
    // user: always assign to self
    if (assignTo) {
      await prisma.fileAssignment.create({
        data: {
          file: { connect: { id: created.id } },
          user: { connect: { id: assignTo } },
          assignedBy: { connect: { id: (me as any).id } },
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