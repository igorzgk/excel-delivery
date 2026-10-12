import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireSignedIn() {
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

  return {
    ok: true as const,
    userId,
    role,
  };
}

const CreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80),

  // ADMIN may create a folder
  // specifically for one user.
  userId: z
    .string()
    .trim()
    .min(1)
    .optional(),

  // Kept for compatibility with
  // the current admin page.
  shared: z.boolean().optional(),
});

export async function GET(req: Request) {
  const guard = await requireSignedIn();

  if (!guard.ok) {
    return guard.res;
  }

  const { searchParams } =
    new URL(req.url);

  const userIdParam =
    searchParams
      .get("userId")
      ?.trim() || undefined;

  /*
   * ADMIN
   *
   * No userId:
   * return shared/global folders only.
   */
  if (
    guard.role === "ADMIN" &&
    !userIdParam
  ) {
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
   * ADMIN querying a specific user:
   *
   * show:
   * - personal folders of that user
   * - shared/global folders
   */
  if (
    guard.role === "ADMIN" &&
    userIdParam
  ) {
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
   * show:
   * - own personal folders
   * - shared/global folders
   */
  const folders =
    await prisma.pdfFolder.findMany({
      where: {
        OR: [
          {
            ownerId:
              guard.userId,
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
        detail:
          parsed.error.flatten(),
      },
      {
        status: 400,
      }
    );
  }

  const name =
    parsed.data.name;

  let ownerId: string | null;

  /*
   * IMPORTANT NEW BEHAVIOUR
   *
   * ADMIN + userId:
   * personal folder for that user.
   *
   * ADMIN without userId:
   * GLOBAL / SHARED folder.
   *
   * This means the admin page does NOT
   * depend on shared:true anymore.
   */
  if (
    guard.role === "ADMIN" &&
    parsed.data.userId
  ) {
    ownerId =
      parsed.data.userId;
  } else if (
    guard.role === "ADMIN"
  ) {
    ownerId = null;
  } else {
    ownerId =
      guard.userId;
  }

  /*
   * Check whether the requested
   * shared/personal folder already exists.
   */
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

  /*
   * Useful recovery:
   *
   * If the admin previously created a
   * folder with the same name and it became
   * ADMIN-owned because of the old code,
   * convert that old folder into a shared
   * folder instead of creating another copy.
   */
  if (
    guard.role === "ADMIN" &&
    ownerId === null
  ) {
    const oldAdminFolder =
      await prisma.pdfFolder.findFirst({
        where: {
          ownerId:
            guard.userId,
          name,
        },
        select: {
          id: true,
        },
      });

    if (oldAdminFolder) {
      const converted =
        await prisma.pdfFolder.update({
          where: {
            id:
              oldAdminFolder.id,
          },
          data: {
            ownerId: null,
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
          folder: converted,
          convertedFromAdminFolder:
            true,
        },
        {
          status: 200,
        }
      );
    }
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