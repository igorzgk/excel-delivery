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
  name: z.string().trim().min(1).max(80),

  // Admin may create a folder for a specific user.
  userId: z
    .string()
    .trim()
    .min(1)
    .optional(),
});

/**
 * GET /api/pdf-folders
 *
 * USER:
 *   Returns only that user's own folders.
 *
 * ADMIN + ?userId=xxx:
 *   Returns only that specific user's folders.
 *
 * ADMIN without userId:
 *   Returns an empty list.
 *
 * There are no global/shared folders anymore.
 */
export async function GET(req: Request) {
  const guard = await requireSignedIn();

  if (!guard.ok) {
    return guard.res;
  }

  const { searchParams } = new URL(req.url);

  const userIdParam =
    searchParams.get("userId")?.trim() ||
    undefined;

  let ownerId: string | null = null;

  if (guard.role === "ADMIN") {
    /**
     * Admin must specify which user's
     * folder space is being viewed.
     *
     * Other admin-specific folder management
     * will be handled by /api/admin/pdf-folders.
     */
    if (!userIdParam) {
      return NextResponse.json(
        {
          ok: true,
          folders: [],
        },
        {
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    /**
     * Make sure the requested user exists
     * and is not an admin account.
     */
    const targetUser =
      await prisma.user.findUnique({
        where: {
          id: userIdParam,
        },
        select: {
          id: true,
          role: true,
        },
      });

    if (
      !targetUser ||
      targetUser.role === "ADMIN"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "user_not_found",
        },
        {
          status: 404,
        }
      );
    }

    ownerId = targetUser.id;
  } else {
    /**
     * Normal users may only access
     * their own folder space.
     */
    ownerId = guard.userId;
  }

  const folders =
    await prisma.pdfFolder.findMany({
      where: {
        ownerId,
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

/**
 * POST /api/pdf-folders
 *
 * USER:
 *   Creates a folder owned by themselves.
 *
 * ADMIN:
 *   Must supply userId.
 *   Creates a folder owned by that user.
 *
 * This endpoint never creates ownerId = null.
 */
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
    parsed.data.name.trim();

  let ownerId: string;

  if (guard.role === "ADMIN") {
    /**
     * Admin must explicitly choose
     * which user owns the folder.
     */
    if (!parsed.data.userId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "user_id_required",
        },
        {
          status: 400,
        }
      );
    }

    const targetUser =
      await prisma.user.findUnique({
        where: {
          id: parsed.data.userId,
        },
        select: {
          id: true,
          role: true,
        },
      });

    if (
      !targetUser ||
      targetUser.role === "ADMIN"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "user_not_found",
        },
        {
          status: 404,
        }
      );
    }

    ownerId = targetUser.id;
  } else {
    /**
     * Normal user:
     * folder always belongs to themselves.
     */
    ownerId = guard.userId;
  }

  /**
   * Because schema has:
   *
   * @@unique([ownerId, name])
   *
   * the same user cannot have the same
   * folder twice.
   *
   * Different users CAN have the same name.
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