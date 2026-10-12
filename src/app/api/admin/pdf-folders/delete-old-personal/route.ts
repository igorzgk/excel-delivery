import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
        { status: 401 }
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
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    userId,
  };
}

/*
 * GET = preview only
 */
export async function GET() {
  const guard = await requireAdmin();

  if (!guard.ok) {
    return guard.res;
  }

  const oldFolders =
    await prisma.pdfFolder.findMany({
      where: {
        ownerId: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        _count: {
          select: {
            files: true,
          },
        },
      },
    });

  const sharedFolders =
    await prisma.pdfFolder.count({
      where: {
        ownerId: null,
      },
    });

  const filesInsideOldFolders =
    oldFolders.reduce(
      (sum, folder) =>
        sum + folder._count.files,
      0
    );

  return NextResponse.json({
    ok: true,
    oldPersonalFolders:
      oldFolders.length,
    sharedFoldersKept:
      sharedFolders,
    filesThatWillBeDetached:
      filesInsideOldFolders,
    oldFolders,
  });
}

/*
 * POST = delete all old personal folders
 *
 * Files are NOT deleted.
 * Their pdfFolderId is simply set to null.
 */
export async function POST() {
  const guard = await requireAdmin();

  if (!guard.ok) {
    return guard.res;
  }

  const oldFolders =
    await prisma.pdfFolder.findMany({
      where: {
        ownerId: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    });

  const oldFolderIds =
    oldFolders.map(
      (folder) => folder.id
    );

  if (
    oldFolderIds.length === 0
  ) {
    return NextResponse.json({
      ok: true,
      detachedFiles: 0,
      deletedFolders: 0,
      message:
        "Δεν υπάρχουν παλιοί προσωπικοί φάκελοι.",
    });
  }

  const result =
    await prisma.$transaction(
      async (tx) => {
        const detached =
          await tx.file.updateMany({
            where: {
              pdfFolderId: {
                in: oldFolderIds,
              },
            },
            data: {
              pdfFolderId: null,
            },
          });

        const deleted =
          await tx.pdfFolder.deleteMany({
            where: {
              id: {
                in: oldFolderIds,
              },
            },
          });

        return {
          detachedFiles:
            detached.count,
          deletedFolders:
            deleted.count,
        };
      }
    );

  return NextResponse.json({
    ok: true,
    ...result,
  });
}