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
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function safeFilename(name: string) {
  return (name || "file").replace(/[^\w.\-() ]+/g, "_");
}

function parseSelectedUserIds(form: FormData): string[] {
  const values = form
    .getAll("assignTo")
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const result: string[] = [];

  for (const value of values) {
    if (value === "ALL") {
      result.push("ALL");
      continue;
    }

    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const id = String(item || "").trim();
          if (id) result.push(id);
        }
        continue;
      }
    } catch {
      // The value is probably a normal user ID.
    }

    result.push(value);
  }

  return Array.from(new Set(result));
}

export async function GET(req: Request) {
  const me = await currentUser();

  if (!me) {
    return NextResponse.json(
      { error: "unauthenticated" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");

  const isAdmin =
    (me as any).role === "ADMIN" &&
    scope === "all";

  const where = isAdmin
    ? undefined
    : {
        OR: [
          {
            uploadedById: (me as any).id,
          },
          {
            assignments: {
              some: {
                userId: (me as any).id,
              },
            },
          },
        ],
      };

  const files = await prisma.file.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      originalName: true,
      url: true,
      mime: true,
      size: true,
      createdAt: true,
      pdfFolderId: true,

      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },

      ...(isAdmin
        ? {
            assignments: {
              select: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
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
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

export async function POST(req: Request) {
  const me = await currentUser();

  if (!me) {
    return NextResponse.json(
      { error: "unauthenticated" },
      { status: 401 }
    );
  }

  const meId = String((me as any).id);
  const isAdmin = (me as any).role === "ADMIN";

  let uploadedStorageKey: string | null = null;

  try {
    const form = await req.formData();

    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "missing_file" },
        { status: 400 }
      );
    }

    const suppliedTitle = String(form.get("title") || "").trim();

    const rawOriginalName = file.name || "file";
    const originalName = safeFilename(rawOriginalName);

    const title =
      suppliedTitle ||
      originalName.replace(/\.[^/.]+$/, "");

    if (!title) {
      return NextResponse.json(
        { error: "missing_title" },
        { status: 400 }
      );
    }

    let selectedUserIds = parseSelectedUserIds(form);

    /*
     * Normal users are always restricted to themselves.
     * An admin may select multiple users or ALL.
     */
    if (!isAdmin) {
      selectedUserIds = [meId];
    } else if (selectedUserIds.includes("ALL")) {
      const allActiveUsers = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          role: "USER",
        },
        select: {
          id: true,
        },
      });

      selectedUserIds = allActiveUsers.map((user) => user.id);
    } else if (selectedUserIds.length > 0) {
      /*
       * Validate the IDs received from the client.
       * This prevents assignments to unknown users.
       */
      const validUsers = await prisma.user.findMany({
        where: {
          id: {
            in: selectedUserIds,
          },
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      });

      selectedUserIds = validUsers.map((user) => user.id);
    }

    selectedUserIds = Array.from(new Set(selectedUserIds));

    const lower = originalName.toLowerCase();
    const contentTypeRaw = file.type || "";

    const mime =
      contentTypeRaw ||
      (lower.endsWith(".pdf")
        ? "application/pdf"
        : lower.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : lower.endsWith(".xls")
        ? "application/vnd.ms-excel"
        : "application/octet-stream");

    const buffer = Buffer.from(await file.arrayBuffer());

    const dotIndex = originalName.lastIndexOf(".");
    const extension =
      dotIndex >= 0
        ? originalName.slice(dotIndex).toLowerCase()
        : "";

    const storageKey = `${crypto.randomUUID()}${extension}`;
    uploadedStorageKey = storageKey;

    const supabase = supabaseAdmin();

    const uploadResult = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (uploadResult.error) {
      console.error("Supabase upload failed:", uploadResult.error);

      return NextResponse.json(
        {
          error: "upload_failed",
          detail: uploadResult.error.message,
          bucket: BUCKET,
        },
        { status: 500 }
      );
    }

    const url = `/api/files/download/${encodeURIComponent(storageKey)}`;

    const created = await prisma.$transaction(async (tx) => {
      const createdFile = await tx.file.create({
        data: {
          title,
          originalName,
          url,
          mime,
          size: buffer.length,
          uploadedById: meId,
        },
        select: {
          id: true,
          title: true,
          originalName: true,
          url: true,
          mime: true,
          size: true,
          createdAt: true,
        },
      });

      if (selectedUserIds.length > 0) {
        await tx.fileAssignment.createMany({
          data: selectedUserIds.map((userId) => ({
            fileId: createdFile.id,
            userId,
            assignedById: meId,
          })),
          skipDuplicates: true,
        });
      }

      return createdFile;
    });

    return NextResponse.json(
      {
        ok: true,
        file: created,
        id: created.id,
        assignedCount: selectedUserIds.length,
        assignedUserIds: selectedUserIds,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/files failed:", error);

    /*
     * If Storage succeeded but the database operation failed,
     * remove the orphaned Supabase object.
     */
    if (uploadedStorageKey) {
      try {
        await supabaseAdmin()
          .storage
          .from(BUCKET)
          .remove([uploadedStorageKey]);
      } catch (cleanupError) {
        console.error(
          "Could not remove orphaned storage object:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        error: "server_error",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}