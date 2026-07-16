import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, currentUser } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";

const Schema = z.object({
  fileId: z.string().min(1),

  // Backwards compatibility with the old frontend.
  userId: z.string().min(1).optional(),

  // New multiple-user option.
  userIds: z.array(z.string().min(1)).optional(),

  // Assign to every active normal user.
  all: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const guard = await requireRole("ADMIN");

  if (!guard.ok) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: guard.status }
    );
  }

  const me = await currentUser();

  if (!me) {
    return NextResponse.json(
      { error: "unauthenticated" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_payload",
          issues: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const file = await prisma.file.findUnique({
      where: {
        id: data.fileId,
      },
      select: {
        id: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: "file_not_found" },
        { status: 404 }
      );
    }

    let requestedUserIds: string[] = [];

    if (data.all) {
      const allActiveUsers = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          role: "USER",
        },
        select: {
          id: true,
        },
      });

      requestedUserIds = allActiveUsers.map((user) => user.id);
    } else {
      requestedUserIds = [
        ...(data.userIds || []),
        ...(data.userId ? [data.userId] : []),
      ];
    }

    requestedUserIds = Array.from(
      new Set(
        requestedUserIds
          .map((id) => String(id || "").trim())
          .filter(Boolean)
      )
    );

    if (requestedUserIds.length === 0) {
      return NextResponse.json(
        { error: "no_users_selected" },
        { status: 400 }
      );
    }

    const validUsers = await prisma.user.findMany({
      where: {
        id: {
          in: requestedUserIds,
        },
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    const validUserIds = validUsers.map((user) => user.id);

    if (validUserIds.length === 0) {
      return NextResponse.json(
        { error: "no_valid_users" },
        { status: 400 }
      );
    }

    const result = await prisma.fileAssignment.createMany({
      data: validUserIds.map((userId) => ({
        fileId: data.fileId,
        userId,
        assignedById: String((me as any).id),
      })),
      skipDuplicates: true,
    });

    return NextResponse.json(
      {
        ok: true,
        requestedCount: requestedUserIds.length,
        validCount: validUserIds.length,
        createdCount: result.count,
        userIds: validUserIds,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/assignments failed:", error);

    return NextResponse.json(
      {
        error: "server_error",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}