// src/app/api/pdf-folders/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

export const runtime = "nodejs";

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

  // Admin may create a folder
  // specifically for another user.
  userId: z
    .string()
    .trim()
    .min(1)
    .optional(),

  // Admin may create a GLOBAL folder.
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
   * GET /api/pdf-folders
   * -> shared/global folders only
   *
   * GET /api/pdf-folders?userId=USER_ID
   * -> that user's personal folders
   *    + shared/global folders
   */
  if (guard.role === "ADMIN") {
    if (!userIdParam) {
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

      return NextResponse.json({
        ok: true,
        folders,
      });
    }

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

    return NextResponse.json({
      ok: true,
      folders,
    });
  }

  /*
   * NORMAL USER
   *
   * Sees:
   * - own personal folders
   * - shared/global folders
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

  return NextResponse.json({
    ok: true,
    folders,
  });
}

export async function POST(
  req: Request
) {
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
      },
      {
        status: 400,
      }
    );
  }

  const name = parsed.data.name;

  let ownerId: string | null;

  /*
   * ADMIN + shared:true
   * -> global folder
   */
  if (
    guard.role === "ADMIN" &&
    parsed.data.shared === true
  ) {
    ownerId = null;
  }

  /*
   * ADMIN + userId
   * -> personal folder for that user
   */
  else if (
    guard.role === "ADMIN" &&
    parsed.data.userId
  ) {
    ownerId =
      parsed.data.userId;
  }

  /*
   * ADMIN without shared/userId
   * -> admin-owned personal folder
   */
  else if (
    guard.role === "ADMIN"
  ) {
    ownerId = guard.userId;
  }

  /*
   * Normal user
   * -> own personal folder
   */
  else {
    ownerId = guard.userId;
  }

  /*
   * We check duplicates ourselves because
   * PostgreSQL UNIQUE with NULL values can
   * allow multiple NULL entries.
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