// src/app/api/integrations/uploads/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/apiKeyAuth";
import { supabasePutBuffer } from "@/lib/storage-supabase";
import { logAudit } from "@/lib/audit";
import { extractEmailsFromText, resolveAssigneeIdsByEmails } from "@/lib/assignmentRules";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "Files"; // must match your existing bucket (same as /api/files)

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

const BodySchema = z.object({
  title: z.string().optional(),
  url: z.string().url(), // public URL to fetch from
  originalName: z.string().optional(), // e.g. orders_john@doe.com.xlsx
  uploadedByEmail: z.string().email().optional(),
});

// (NEW) Simple schema object for GET response (self-doc/health)
const SchemaDoc = {
  endpoint: "POST /api/integrations/uploads",
  expectsHeaders: {
    "x-api-key": "YOUR_PLAIN_KEY",
    "Content-Type": "application/json",
  },
  expectsBody: {
    title: "string (optional, used as display title; falls back to filename)",
    url: "string (required, public or signed URL)",
    originalName: "string (optional; if given, used for display/filename heuristics)",
    uploadedByEmail: "string (optional; attribution if it matches a user)",
  },
  notes: [
    "Auto-assign: ανιχνεύουμε emails μέσα σε title/originalName και (βελτίωση) και στο url.",
    "ΜΗΝ βάζετε email στο URL path (privacy/logging). Αν είναι στο ίδιο το url string, το εντοπίζουμε.",
    "Επιστρέφουμε πάντα JSON. Αν δείτε HTML, λείπουν headers ή είναι λάθος μέθοδος/URL.",
  ],
};

async function getAssignerId(uploadedById?: string | null) {
  if (uploadedById) {
    const u = await prisma.user.findUnique({ where: { id: uploadedById }, select: { role: true } });
    if (u?.role === "ADMIN") return uploadedById;
  }
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  return admin?.id ?? null;
}

/**
 * Dedup helpers
 * Goal: when a new monthly file arrives (e.g. *_2-2026.xlsx), remove older monthly versions for the SAME user.
 * IMPORTANT: If an older file is assigned to multiple users, we only remove the assignment for this user.
 * We delete the actual file + storage object only when it has no more assignments.
 */
function normalizeFilenameForDedup(name: string) {
  const n = (name || "").trim();
  if (!n) return "";

  const dot = n.lastIndexOf(".");
  const base = dot > 0 ? n.slice(0, dot) : n;
  const ext = dot > 0 ? n.slice(dot) : "";

  // Remove trailing month-year like:
  // _2-2026, -02-2026, _02_2026, -2_2026 etc (end of string)
  const cleanedBase = base.replace(/([_-])?(0?[1-9]|1[0-2])([_-])\d{4}$/i, "");

  return (cleanedBase + ext).toLowerCase();
}

function extractStorageKeyFromDownloadUrl(url?: string | null) {
  if (!url) return null;
  const m = url.match(/\/api\/files\/download\/(.+)$/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

async function dedupeAssignmentsForUser(params: { userId: string; keepFileId: string; keepOriginalName: string }) {
  const { userId, keepFileId, keepOriginalName } = params;
  const dedupeKey = normalizeFilenameForDedup(keepOriginalName);
  if (!dedupeKey) return;

  // Find "other" files assigned to this user
  const assigned = await prisma.fileAssignment.findMany({
    where: { userId },
    select: {
      fileId: true,
      file: {
        select: { id: true, originalName: true, url: true },
      },
    },
  });

  const duplicates = assigned
    .filter((a) => a.fileId !== keepFileId)
    .map((a) => a.file)
    .filter((f) => normalizeFilenameForDedup(f.originalName || "") === dedupeKey);

  if (!duplicates.length) return;

  const sb = supabaseAdmin();

  for (const oldFile of duplicates) {
    // 1) remove assignment only for this user
    await prisma.fileAssignment.deleteMany({
      where: { userId, fileId: oldFile.id },
    });

    // 2) if file has no other assignments, delete file record + storage object
    const remainingAssignments = await prisma.fileAssignment.count({
      where: { fileId: oldFile.id },
    });

    if (remainingAssignments === 0) {
      const storageKey = extractStorageKeyFromDownloadUrl(oldFile.url);
      if (storageKey) {
        // best-effort storage cleanup
        const rm = await sb.storage.from(BUCKET).remove([storageKey]);
        if (rm.error) {
          console.warn("Supabase remove failed:", rm.error.message);
        }
      }

      // delete DB record
      await prisma.file.delete({
        where: { id: oldFile.id },
      });
    }
  }
}

/**
 * GET: Health + schema (για scheduler/diagnostics). Πάντα JSON.
 */
export async function GET(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  return NextResponse.json(
    {
      ok: true,
      ...SchemaDoc,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * POST: JSON by URL (title, url, uploadedByEmail?, originalName?)
 */
export async function POST(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.res;

  let data: z.infer<typeof BodySchema>;
  try {
    data = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  // 1) Download the file bytes
  const r = await fetch(data.url, { redirect: "follow" });
  if (!r.ok) return NextResponse.json({ ok: false, error: `Fetch failed (${r.status})` }, { status: 400 });
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
      url: publicUrl, // <- dashboard uses this
      mime: contentType,
      size: buf.byteLength,
      uploadedById,
    },
    select: { id: true, title: true, originalName: true, url: true, createdAt: true },
  });

  // 5) Auto-assign by emails in filename/title/url + uploadedByEmail
  const candidates = Array.from(
    new Set([
      ...extractEmailsFromText(`${record.originalName} ${record.title} ${data.url}`),
      ...(data.uploadedByEmail ? [data.uploadedByEmail] : []), // <- treat uploadedByEmail as assignee, too
    ])
  );

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

  // ✅ 5b) DEDUPE per-user (remove older monthly versions for the same user)
  if (assigneeIds.length) {
    for (const userId of assigneeIds) {
      await dedupeAssignmentsForUser({
        userId,
        keepFileId: record.id,
        keepOriginalName: record.originalName || "",
      });
    }
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
      dedupeKey: normalizeFilenameForDedup(record.originalName || ""),
    },
  });

  return NextResponse.json(
    {
      ok: true,
      file: record,
      assignedCount: assigneeIds.length,
      key: keyPath,
      signedUrl: put.signedUrl,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}