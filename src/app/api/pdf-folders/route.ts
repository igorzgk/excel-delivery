import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireSignedIn() {
  const session = await getServerSession(authOptions);

  const userId = (session as any)?.user?.id as string | undefined;
  const role = (session as any)?.user?.role as string | undefined;

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

  return {
    ok: true as const,
    userId,
    role,
  };
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  userId: z.string().trim().min(1).optional(),
  shared: z.boolean().optional(),
});

/*
 * Ensures that every existing folder name
 * used by normal users also exists once
 * as a GLOBAL folder with ownerId = null.
 *
 * Existing personal folders are NOT changed.
 */
async function ensureSharedFoldersFromExisting() {
  const existingFolders = await prisma.pdfFolder.findMany({
    where: {
      ownerId: {
        not: null,
      },
    },
    select: {
      name: true,
    },
  });

  const uniqueNames = Array.from(
    new Set(
      existingFolders
        .map((folder) => folder.name.trim())
        .filter(Boolean)
    )
  );

  if (uniqueNames.length === 0) {
    return;
  }

  const existingShared =
    await prisma.pdfFolder.findMany({
      where: {
        ownerId: null,
      },
      select: {
        name: true,
      },
    });

  const sharedNames = new Set(
    existingShared.map((folder) => folder.name.trim())
  );

  for (const name of uniqueNames) {
    if (sharedNames.has(name)) {
      continue;
    }

    /*
     * Check again before create because
     * ownerId = null is not reliably protected
     * by a compound SQL UNIQUE constraint.
     */
    const alreadyExists =
      await prisma.pdfFolder.findFirst({
        where: {
          ownerId: null,
          name,
        },
        select: {
          id: true,
        },
      });

    if (alreadyExists) {
      continue;
    }

    await prisma.pdfFolder.create({
      data: {
        name,
        ownerId: null,
      },
    });
  }
}

export async function GET(req: Request) {
  const guard = await requireSignedIn();

  if (!guard.ok) {
    return guard.res;
  }

  const { searchParams } = new URL(req.url);

  const userIdParam =
    searchParams.get("userId")?.trim() || undefined;

  /*
   * ADMIN without userId
   *
   * Automatically sync the existing common
   * folder names into global/shared folders.
   */
  if (
    guard.role === "ADMIN" &&
    !userIdParam
  ) {
    await ensureSharedFoldersFromExisting();

    const folders =
      await prisma.pdfFolder.findMany({
        where: {
          ownerId: null,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          ownerId: true,
          createdAt: true,
        },
      });

    return NextResponse.json(
      {
        ok: true,
        folders,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  /*
   * ADMIN looking at a specific user:
   *
   * personal folders + global folders
   */
  if (
    guard.role === "ADMIN" &&
    userIdParam
  ) {
    await ensureSharedFoldersFromExisting();

    const folders =
      await prisma.pdfFolder.findMany({
        where: {
          OR: [
            {
              ownerId: userIdParam,
            },
            {
              ownerId: null,
            },
          ],
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          ownerId: true,
          createdAt: true,
        },
      });

    return NextResponse.json(
      {
        ok: true,
        folders,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  /*
   * NORMAL USER
   *
   * personal folders + global folders
   */
  const folders =
    await prisma.pdfFolder.findMany({
      where: {
        OR: [
          {
            ownerId: guard.userId,
          },
          {
            ownerId: null,
          },
        ],
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
      },
    });

  return NextResponse.json(
    {
      ok: true,
      folders,
    },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function POST(req: Request) {
  const guard = await requireSignedIn();

  if (!guard.ok) {
    return guard.res;
  }

  const body = await req
    .json()
    .catch(() => ({}));

  const parsed =
    CreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_payload",
        detail: parsed.error.flatten(),
      },
      {
        status: 400,
      }
    );
  }

  const name = parsed.data.name;

  let ownerId: string | null;

  /*
   * ADMIN + specific user:
   * create personal folder for that user.
   *
   * ADMIN without userId:
   * create GLOBAL folder.
   *
   * Normal user:
   * create own personal folder.
   */
  if (
    guard.role === "ADMIN" &&
    parsed.data.userId
  ) {
    ownerId = parsed.data.userId;
  } else if (guard.role === "ADMIN") {
    ownerId = null;
  } else {
    ownerId = guard.userId;
  }

  const exists =
    await prisma.pdfFolder.findFirst({
      where: {
        ownerId,
        name,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
      },
    });

  if (exists) {
    return NextResponse.json(
      {
        ok: false,
        error: "folder_exists",
        folder: exists,
      },
      {
        status: 409,
      }
    );
  }

  const folder =
    await prisma.pdfFolder.create({
      data: {
        name,
        ownerId,
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
      },
    });

  return NextResponse.json(
    {
      ok: true,
      folder,
    },
    {
      status: 201,
    }
  );
}