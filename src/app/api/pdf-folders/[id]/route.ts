// src/app/api/pdf-folders/[id]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);

  const userId = (session as any)?.user?.id as
    | string
    | undefined;

  const role = (session as any)?.user?.role as
    | string
    | undefined;

  if (!userId) {
    return {
      ok: false as const,
      res: NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
        },
        {
          status: 401,
        }
      ),
    };
  }

  if (role !== "ADMIN") {
    return {
      ok: false as const,
      res: NextResponse.json(
        {
          ok: false,
          error: "forbidden",
        },
        {
          status: 403,
        }
      ),
    };
  }

  return {
    ok: true as const,
    userId,
    role,
  };
}

const PatchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80),
});

/**
 * PATCH /api/pdf-folders/[id]
 *
 * ADMIN ONLY.
 *
 * Renames one PERSONAL folder.
 *
 * ownerId = null folders are the temporary
 * old global folders and are intentionally
 * not handled by this route anymore.
 *
 * Normally the bulk admin endpoint
 * /api/admin/pdf-folders should be used
 * when renaming a standard folder for
 * every user.
 */
export async function PATCH(
  req: Request,
  ctx: {
    params: {
      id: string;
    };
  }
) {
  const guard =
    await requireAdmin();

  if (!guard.ok) {
    return guard.res;
  }

  const folderId =
    ctx.params.id;

  const body = await req
    .json()
    .catch(() => ({}));

  const parsed =
    PatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        detail:
          parsed.error.flatten(),
      },
      {
        status: 400,
      }
    );
  }

  const folder =
    await prisma.pdfFolder.findUnique({
      where: {
        id: folderId,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
      },
    });

  if (!folder) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_found",
      },
      {
        status: 404,
      }
    );
  }

  /**
   * Global/shared folders are obsolete.
   *
   * We don't want this route modifying them.
   */
  if (!folder.ownerId) {
    return NextResponse.json(
      {
        ok: false,
        error: "legacy_global_folder",
      },
      {
        status: 409,
      }
    );
  }

  const name =
    parsed.data.name.trim();

  /**
   * Don't allow the same user to have
   * two folders with the same name.
   */
  const duplicate =
    await prisma.pdfFolder.findFirst({
      where: {
        id: {
          not: folderId,
        },
        ownerId:
          folder.ownerId,
        name,
      },
      select: {
        id: true,
      },
    });

  if (duplicate) {
    return NextResponse.json(
      {
        ok: false,
        error: "folder_exists",
      },
      {
        status: 409,
      }
    );
  }

  const updated =
    await prisma.pdfFolder.update({
      where: {
        id: folderId,
      },
      data: {
        name,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

  return NextResponse.json({
    ok: true,
    folder: updated,
  });
}

/**
 * DELETE /api/pdf-folders/[id]
 *
 * ADMIN ONLY.
 *
 * Deletes one PERSONAL folder.
 *
 * Files themselves are NOT deleted.
 * They are detached from the folder first.
 *
 * Normally /api/admin/pdf-folders should
 * be used when removing a standard folder
 * from multiple/all users.
 */
export async function DELETE(
  req: Request,
  ctx: {
    params: {
      id: string;
    };
  }
) {
  const guard =
    await requireAdmin();

  if (!guard.ok) {
    return guard.res;
  }

  const folderId =
    ctx.params.id;

  const folder =
    await prisma.pdfFolder.findUnique({
      where: {
        id: folderId,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
      },
    });

  if (!folder) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_found",
      },
      {
        status: 404,
      }
    );
  }

  /**
   * Do not touch the temporary
   * global folders here.
   */
  if (!folder.ownerId) {
    return NextResponse.json(
      {
        ok: false,
        error: "legacy_global_folder",
      },
      {
        status: 409,
      }
    );
  }

  const result =
    await prisma.$transaction(
      async (tx) => {
        const detached =
          await tx.file.updateMany({
            where: {
              pdfFolderId:
                folderId,
            },
            data: {
              pdfFolderId:
                null,
            },
          });

        await tx.pdfFolder.delete({
          where: {
            id: folderId,
          },
        });

        return {
          detachedFiles:
            detached.count,
        };
      }
    );

  return NextResponse.json({
    ok: true,
    deletedFolderId:
      folderId,
    detachedFiles:
      result.detachedFiles,
  });
}