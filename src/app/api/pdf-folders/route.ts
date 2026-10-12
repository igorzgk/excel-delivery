// src/app/api/pdf-folders/route.ts

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
        { status: 401 }
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

export async function GET(req: Request) {
  const guard = await requireSignedIn();

  if (!guard.ok) {
    return guard.res;
  }

  const { searchParams } = new URL(req.url);

  const userIdParam =
    searchParams.get("userId")?.trim() || undefined;

  /*
   * ADMIN, no userId:
   * shared/global folders only
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

        // temporary debugging
        debug: {
          sessionUserId: guard.userId,
          sessionRole: guard.role,
          mode: "ADMIN_SHARED",
        },
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
   * personal + shared
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
        debug: {
          sessionUserId: guard.userId,
          sessionRole: guard.role,
          mode: "ADMIN_USER",
          targetUserId: userIdParam,
        },
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
   * personal + shared
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
      debug: {
        sessionUserId: guard.userId,
        sessionRole: guard.role,
        mode: "USER",
      },
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

        debug: {
          body,
          sessionUserId:
            guard.userId,
          sessionRole:
            guard.role,
        },
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
   * ADMIN shared folder
   */
  if (
    guard.role === "ADMIN" &&
    parsed.data.shared === true
  ) {
    ownerId = null;
  }

  /*
   * ADMIN user-specific folder
   */
  else if (
    guard.role === "ADMIN" &&
    parsed.data.userId
  ) {
    ownerId =
      parsed.data.userId;
  }

  /*
   * ADMIN personal folder
   */
  else if (
    guard.role === "ADMIN"
  ) {
    ownerId =
      guard.userId;
  }

  /*
   * NORMAL USER
   */
  else {
    ownerId =
      guard.userId;
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
      },
    });

  if (exists) {
    return NextResponse.json(
      {
        ok: false,
        error: "folder_exists",
        existingFolder: exists,

        debug: {
          receivedShared:
            parsed.data.shared,
          receivedUserId:
            parsed.data.userId ??
            null,
          sessionUserId:
            guard.userId,
          sessionRole:
            guard.role,
          calculatedOwnerId:
            ownerId,
        },
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

      debug: {
        receivedShared:
          parsed.data.shared,
        receivedUserId:
          parsed.data.userId ??
          null,
        sessionUserId:
          guard.userId,
        sessionRole:
          guard.role,
        calculatedOwnerId:
          ownerId,
      },
    },
    {
      status: 201,
    }
  );
}