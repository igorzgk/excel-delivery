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

  // ADMIN only:
  // create a folder belonging to a specific user
  userId: z
    .string()
    .trim()
    .min(1)
    .optional(),

  // ADMIN only:
  // shared folder visible to all normal users
  shared: z
    .boolean()
    .optional(),
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
   * ADMIN without userId:
   *
   * Return GLOBAL / SHARED folders only.
   *
   * These are the folders that should appear in:
   * - Admin PDF explorer
   * - Admin PDF upload dropdown
   * - "Assign to everyone" workflow
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
   * ADMIN querying one specific user:
   *
   * Return:
   * - that user's personal folders
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
              ownerId:
                userIdParam,
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
   * NORMAL USER:
   *
   * Return:
   * - their own personal folders
   * - all shared/global folders
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

export async function POST(
  req: Request
) {
  const guard =
    await requireSignedIn();

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
   * ADMIN + shared:true
   *
   * Create one common folder.
   *
   * ownerId = null
   */
  if (
    guard.role === "ADMIN" &&
    parsed.data.shared === true
  ) {
    ownerId = null;
  }

  /*
   * ADMIN + userId
   *
   * Create personal folder for
   * a particular normal user.
   */
  else if (
    guard.role === "ADMIN" &&
    parsed.data.userId
  ) {
    ownerId =
      parsed.data.userId;
  }

  /*
   * ADMIN creating without either
   * shared:true or userId.
   *
   * Keep old behaviour:
   * admin-owned personal folder.
   */
  else if (
    guard.role === "ADMIN"
  ) {
    ownerId =
      guard.userId;
  }

  /*
   * Normal users always create
   * their own folder.
   */
  else {
    ownerId =
      guard.userId;
  }

  /*
   * Check duplicate manually.
   *
   * This is especially important
   * for ownerId = null.
   */
  const exists =
    await prisma.pdfFolder.findFirst({
      where: {
        ownerId,
        name,
      },
      select: {
        id: true,
      },
    });

  if (exists) {
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