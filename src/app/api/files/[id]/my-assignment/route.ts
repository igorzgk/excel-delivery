import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth-helpers";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY!;

const BUCKET =
  process.env.SUPABASE_BUCKET || "Files";

function supabaseAdmin() {
  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function storageKeyFromUrl(
  url?: string | null
) {
  if (!url) {
    return null;
  }

  const marker =
    "/api/files/download/";

  const index =
    url.indexOf(marker);

  if (index === -1) {
    return null;
  }

  const encoded =
    url.slice(
      index + marker.length
    );

  if (!encoded) {
    return null;
  }

  try {
    return decodeURIComponent(
      encoded.split("?")[0]
    );
  } catch {
    return encoded.split("?")[0];
  }
}

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const me =
    await currentUser();

  if (!me) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "unauthenticated",
      },
      {
        status: 401,
      }
    );
  }

  const meId =
    String(
      (me as any).id
    );

  const {
    id: fileId,
  } = await params;

  const file =
    await prisma.file.findUnique(
      {
        where: {
          id: fileId,
        },

        select: {
          id: true,
          url: true,
          uploadedById: true,

          assignments: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      }
    );

  if (!file) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "not_found",
      },
      {
        status: 404,
      }
    );
  }

  const myAssignment =
    file.assignments.find(
      (assignment) =>
        assignment.userId ===
        meId
    );

  const isMyLegacyUpload =
    file.uploadedById ===
    meId;

  if (
    !myAssignment &&
    !isMyLegacyUpload
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "forbidden",
      },
      {
        status: 403,
      }
    );
  }

  /*
   * Shared file:
   *
   * Remove only THIS user's assignment.
   * Physical File + Supabase object stay.
   */
  if (
    myAssignment &&
    file.assignments.length >
      1
  ) {
    await prisma.fileAssignment.delete(
      {
        where: {
          id:
            myAssignment.id,
        },
      }
    );

    return NextResponse.json({
      ok: true,
      removedFromUser:
        true,
      fileDeleted:
        false,
    });
  }

  /*
   * Legacy edge-case:
   *
   * User uploaded the file, has no own
   * assignment, but other users still use it.
   * Do not allow deleting the shared object.
   */
  if (
    !myAssignment &&
    file.assignments.length >
      0
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "file_used_by_other_users",
        detail:
          "Το αρχείο χρησιμοποιείται από άλλους χρήστες και δεν μπορεί να διαγραφεί συνολικά.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * Last/only user of this file.
   *
   * Delete DB File.
   * FileAssignment is removed by cascade.
   */
  await prisma.file.delete({
    where: {
      id: fileId,
    },
  });

  /*
   * Then remove the physical object.
   *
   * If an old file uses a different URL
   * format we simply leave cleanup to the
   * existing admin storage tools.
   */
  const storageKey =
    storageKeyFromUrl(
      file.url
    );

  if (storageKey) {
    try {
      const result =
        await supabaseAdmin()
          .storage
          .from(BUCKET)
          .remove([
            storageKey,
          ]);

      if (
        result.error
      ) {
        console.error(
          "Could not remove deleted user file from storage:",
          result.error
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Storage cleanup failed:",
        error
      );
    }
  }

  return NextResponse.json({
    ok: true,
    removedFromUser:
      true,
    fileDeleted:
      true,
  });
}