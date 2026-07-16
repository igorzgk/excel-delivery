import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime = "nodejs";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;

const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY!;

const BUCKET = process.env.SUPABASE_BUCKET || "Files";

const DeleteSchema = z.object({
  userIds: z.array(z.string().min(1)).optional().default([]),
  deleteEntireFile: z.boolean().optional().default(false),
});

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function extractStorageKey(url?: string | null) {
  if (!url) return null;

  const marker = "/api/files/download/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  const encodedKey = url.slice(index + marker.length).split("?")[0];

  try {
    return decodeURIComponent(encodedKey);
  } catch {
    return encodedKey;
  }
}

export async function DELETE(
  req: Request,
  ctx: {
    params: {
      id: string;
    };
  }
) {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    (session.user as any).role !== "ADMIN"
  ) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403 }
    );
  }

  const fileId = ctx.params.id;

  try {
    const file = await prisma.file.findUnique({
      where: {
        id: fileId,
      },
      select: {
        id: true,
        title: true,
        url: true,
        assignments: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404 }
      );
    }

    /*
     * Keep compatibility with the old delete button:
     * a DELETE request without a JSON body deletes the entire file.
     */
    const rawBody = await req.text().catch(() => "");

    let deleteEntireFile = !rawBody.trim();
    let selectedUserIds: string[] = [];

    if (rawBody.trim()) {
      let parsedJson: unknown;

      try {
        parsedJson = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { error: "invalid_json" },
          { status: 400 }
        );
      }

      const parsed = DeleteSchema.safeParse(parsedJson);

      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "invalid_payload",
            issues: parsed.error.flatten(),
          },
          { status: 400 }
        );
      }

      deleteEntireFile = parsed.data.deleteEntireFile;

      selectedUserIds = Array.from(
        new Set(
          parsed.data.userIds
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        )
      );
    }

    if (deleteEntireFile) {
      const storageKey = extractStorageKey(file.url);

      /*
       * Remove Storage first. If it fails because the object is already
       * missing, the DB record should still be removed.
       */
      let storageWarning: string | null = null;

      if (storageKey) {
        const result = await supabaseAdmin()
          .storage
          .from(BUCKET)
          .remove([storageKey]);

        if (result.error) {
          storageWarning = result.error.message;

          console.error(
            "Supabase file deletion warning:",
            result.error
          );
        }
      }

      await prisma.file.delete({
        where: {
          id: fileId,
        },
      });

      return NextResponse.json(
        {
          ok: true,
          mode: "entire_file",
          deletedFileId: fileId,
          storageKey,
          storageWarning,
        },
        { status: 200 }
      );
    }

    if (selectedUserIds.length === 0) {
      return NextResponse.json(
        { error: "no_users_selected" },
        { status: 400 }
      );
    }

    const deleteResult = await prisma.fileAssignment.deleteMany({
      where: {
        fileId,
        userId: {
          in: selectedUserIds,
        },
      },
    });

    const remainingAssignments =
      await prisma.fileAssignment.count({
        where: {
          fileId,
        },
      });

    return NextResponse.json(
      {
        ok: true,
        mode: "selected_assignments",
        removedAssignments: deleteResult.count,
        requestedUserIds: selectedUserIds,
        remainingAssignments,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(
      `DELETE /api/admin/files/${fileId} failed:`,
      error
    );

    return NextResponse.json(
      {
        error: "server_error",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}