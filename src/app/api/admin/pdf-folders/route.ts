import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Standard folder creation.
 *
 * A folder created here is created for
 * EVERY normal USER account.
 */
const CreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80),
  })
  .strict();

/**
 * Standard folder rename.
 *
 * Every personal copy with oldName
 * becomes newName.
 */
const RenameSchema = z
  .object({
    oldName: z
      .string()
      .trim()
      .min(1)
      .max(80),

    newName: z
      .string()
      .trim()
      .min(1)
      .max(80),
  })
  .strict();

/**
 * Standard folder deletion.
 *
 * Every personal copy of this folder
 * is deleted.
 */
const DeleteSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80),
  })
  .strict();

async function requireAdmin() {
  const guard =
    await requireRole("ADMIN");

  if (!guard.ok) {
    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            ok: false,
            error:
              "unauthorized",
          },
          {
            status:
              guard.status,
          }
        ),
    };
  }

  return {
    ok: true as const,
  };
}

/**
 * All normal application users.
 *
 * We intentionally include:
 * - ACTIVE
 * - PENDING
 * - SUSPENDED
 *
 * because the standard folder structure
 * should be identical for every USER.
 */
async function getNormalUsers() {
  return prisma.user.findMany({
    where: {
      role: "USER",
    },

    orderBy: [
      {
        name: "asc",
      },
      {
        email: "asc",
      },
    ],

    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });
}

/**
 * ---------------------------------------------------------
 * GET
 * ---------------------------------------------------------
 *
 * Returns the standard folder structure
 * grouped by folder name.
 *
 * Example database:
 *
 * User A -> ΑΡΧΕΙΟ ΝΕΡΟΥ -> folder_A
 * User B -> ΑΡΧΕΙΟ ΝΕΡΟΥ -> folder_B
 *
 * Response:
 *
 * ΑΡΧΕΙΟ ΝΕΡΟΥ
 * count: 2
 * totalUsers: 2
 * missingCount: 0
 *
 * IMPORTANT:
 * ownerId = null legacy/global folders are ignored.
 */
export async function GET() {
  const guard =
    await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const users =
    await getNormalUsers();

  const userIds =
    users.map(
      (user) => user.id
    );

  const folders =
    userIds.length > 0
      ? await prisma.pdfFolder.findMany(
          {
            where: {
              ownerId: {
                in: userIds,
              },
            },

            orderBy: [
              {
                name: "asc",
              },
              {
                createdAt:
                  "asc",
              },
            ],

            select: {
              id: true,
              name: true,
              ownerId: true,
              createdAt: true,
            },
          }
        )
      : [];

  const userById =
    new Map(
      users.map(
        (user) => [
          user.id,
          user,
        ]
      )
    );

  const grouped =
    new Map<
      string,
      {
        name: string;
        folderIds: string[];
        users: Array<{
          id: string;
          email: string;
          name:
            | string
            | null;
          status: string;
          folderId: string;
        }>;
        createdAt: Date;
      }
    >();

  for (
    const folder of folders
  ) {
    if (!folder.ownerId) {
      continue;
    }

    const owner =
      userById.get(
        folder.ownerId
      );

    if (!owner) {
      continue;
    }

    const existing =
      grouped.get(
        folder.name
      );

    const group =
      existing || {
        name:
          folder.name,

        folderIds: [],

        users: [],

        createdAt:
          folder.createdAt,
      };

    group.folderIds.push(
      folder.id
    );

    group.users.push({
      id: owner.id,
      email:
        owner.email,
      name:
        owner.name,
      status:
        owner.status,
      folderId:
        folder.id,
    });

    if (
      folder.createdAt <
      group.createdAt
    ) {
      group.createdAt =
        folder.createdAt;
    }

    grouped.set(
      folder.name,
      group
    );
  }

  const totalUsers =
    users.length;

  const folderGroups =
    Array.from(
      grouped.values()
    )
      .map(
        (group) => ({
          ...group,

          count:
            group.users
              .length,

          totalUsers,

          missingCount:
            Math.max(
              0,
              totalUsers -
                group.users
                  .length
            ),

          complete:
            group.users
              .length ===
            totalUsers,

          users:
            group.users.sort(
              (a, b) =>
                (
                  a.name ||
                  a.email
                ).localeCompare(
                  b.name ||
                    b.email,
                  "el"
                )
            ),
        })
      )
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            "el"
          )
      );

  return NextResponse.json(
    {
      ok: true,

      folders:
        folderGroups,

      users,

      totalUsers,
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
 * ---------------------------------------------------------
 * POST
 * ---------------------------------------------------------
 *
 * Creates a standard folder for EVERY
 * normal user.
 *
 * Example:
 *
 * POST
 * {
 *   "name": "ΑΡΧΕΙΟ ΝΕΡΟΥ"
 * }
 *
 * If some users already have it,
 * they are skipped.
 *
 * Missing copies are created.
 */
export async function POST(
  req: Request
) {
  const guard =
    await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const body =
    await req
      .json()
      .catch(() => ({}));

  const parsed =
    CreateSchema.safeParse(
      body
    );

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "invalid_payload",
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

  const users =
    await getNormalUsers();

  const userIds =
    users.map(
      (user) => user.id
    );

  if (
    userIds.length === 0
  ) {
    return NextResponse.json(
      {
        ok: true,
        created: 0,
        skipped: 0,
        totalUsers: 0,
      },
      {
        status: 201,
      }
    );
  }

  const existing =
    await prisma.pdfFolder.findMany(
      {
        where: {
          name,

          ownerId: {
            in: userIds,
          },
        },

        select: {
          ownerId: true,
        },
      }
    );

  const existingOwnerIds =
    new Set(
      existing
        .map(
          (folder) =>
            folder.ownerId
        )
        .filter(
          (
            id
          ): id is string =>
            !!id
        )
    );

  const missingIds =
    userIds.filter(
      (id) =>
        !existingOwnerIds.has(
          id
        )
    );

  if (
    missingIds.length > 0
  ) {
    await prisma.pdfFolder.createMany(
      {
        data:
          missingIds.map(
            (
              ownerId
            ) => ({
              name,
              ownerId,
            })
          ),

        skipDuplicates:
          true,
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,

      created:
        missingIds.length,

      skipped:
        userIds.length -
        missingIds.length,

      totalUsers:
        userIds.length,
    },
    {
      status: 201,
    }
  );
}

/**
 * ---------------------------------------------------------
 * PATCH
 * ---------------------------------------------------------
 *
 * Renames a standard folder for EVERY
 * normal user.
 *
 * It also repairs inconsistencies.
 *
 * If:
 *
 * User A has oldName
 * User A already has newName
 *
 * the two folders are merged.
 *
 * Files from oldName are moved into newName
 * and the old folder is deleted.
 *
 * At the end, every USER is guaranteed
 * to have newName.
 */
export async function PATCH(
  req: Request
) {
  const guard =
    await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const body =
    await req
      .json()
      .catch(() => ({}));

  const parsed =
    RenameSchema.safeParse(
      body
    );

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "invalid_payload",
        detail:
          parsed.error.flatten(),
      },
      {
        status: 400,
      }
    );
  }

  const {
    oldName,
    newName,
  } = parsed.data;

  if (
    oldName === newName
  ) {
    return NextResponse.json(
      {
        ok: true,
        renamed: 0,
        merged: 0,
        createdMissing:
          0,
      }
    );
  }

  const users =
    await getNormalUsers();

  const userIds =
    users.map(
      (user) => user.id
    );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const oldFolders =
          await tx.pdfFolder.findMany(
            {
              where: {
                name:
                  oldName,

                ownerId: {
                  in: userIds,
                },
              },

              select: {
                id: true,
                ownerId: true,
              },
            }
          );

        if (
          oldFolders.length ===
          0
        ) {
          return {
            notFound:
              true,

            renamed: 0,
            merged: 0,
            createdMissing:
              0,
          };
        }

        const targetFolders =
          await tx.pdfFolder.findMany(
            {
              where: {
                name:
                  newName,

                ownerId: {
                  in: userIds,
                },
              },

              select: {
                id: true,
                ownerId: true,
              },
            }
          );

        const targetByOwner =
          new Map<
            string,
            string
          >();

        for (
          const target of
            targetFolders
        ) {
          if (
            target.ownerId
          ) {
            targetByOwner.set(
              target.ownerId,
              target.id
            );
          }
        }

        let renamed = 0;
        let merged = 0;

        for (
          const folder of
            oldFolders
        ) {
          if (
            !folder.ownerId
          ) {
            continue;
          }

          const targetId =
            targetByOwner.get(
              folder.ownerId
            );

          /**
           * User already has newName.
           *
           * Move files into new folder
           * and delete old folder.
           */
          if (targetId) {
            await tx.file.updateMany(
              {
                where: {
                  pdfFolderId:
                    folder.id,
                },

                data: {
                  pdfFolderId:
                    targetId,
                },
              }
            );

            await tx.pdfFolder.delete(
              {
                where: {
                  id: folder.id,
                },
              }
            );

            merged += 1;

            continue;
          }

          /**
           * Normal rename.
           */
          await tx.pdfFolder.update(
            {
              where: {
                id: folder.id,
              },

              data: {
                name:
                  newName,
              },
            }
          );

          targetByOwner.set(
            folder.ownerId,
            folder.id
          );

          renamed += 1;
        }

        /**
         * Repair any users who were
         * already missing oldName.
         *
         * After this operation EVERY
         * user must have newName.
         */
        const finalTargets =
          await tx.pdfFolder.findMany(
            {
              where: {
                name:
                  newName,

                ownerId: {
                  in: userIds,
                },
              },

              select: {
                ownerId: true,
              },
            }
          );

        const finalOwnerIds =
          new Set(
            finalTargets
              .map(
                (folder) =>
                  folder.ownerId
              )
              .filter(
                (
                  id
                ): id is string =>
                  !!id
              )
          );

        const missingIds =
          userIds.filter(
            (id) =>
              !finalOwnerIds.has(
                id
              )
          );

        if (
          missingIds.length >
          0
        ) {
          await tx.pdfFolder.createMany(
            {
              data:
                missingIds.map(
                  (
                    ownerId
                  ) => ({
                    name:
                      newName,
                    ownerId,
                  })
                ),

              skipDuplicates:
                true,
            }
          );
        }

        return {
          notFound:
            false,

          renamed,

          merged,

          createdMissing:
            missingIds.length,
        };
      }
    );

  if (
    result.notFound
  ) {
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

  return NextResponse.json({
    ok: true,

    renamed:
      result.renamed,

    merged:
      result.merged,

    createdMissing:
      result.createdMissing,
  });
}

/**
 * ---------------------------------------------------------
 * DELETE
 * ---------------------------------------------------------
 *
 * Deletes a standard folder from EVERY
 * normal user.
 *
 * PDFs are NOT deleted.
 *
 * Any PDF currently inside one of these
 * folders is detached:
 *
 * pdfFolderId = null
 */
export async function DELETE(
  req: Request
) {
  const guard =
    await requireAdmin();

  if (!guard.ok) {
    return guard.response;
  }

  const body =
    await req
      .json()
      .catch(() => ({}));

  const parsed =
    DeleteSchema.safeParse(
      body
    );

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "invalid_payload",
        detail:
          parsed.error.flatten(),
      },
      {
        status: 400,
      }
    );
  }

  const users =
    await getNormalUsers();

  const userIds =
    users.map(
      (user) => user.id
    );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const folders =
          await tx.pdfFolder.findMany(
            {
              where: {
                name:
                  parsed.data
                    .name,

                ownerId: {
                  in: userIds,
                },
              },

              select: {
                id: true,
              },
            }
          );

        const ids =
          folders.map(
            (folder) =>
              folder.id
          );

        if (
          ids.length === 0
        ) {
          return {
            deletedFolders:
              0,

            detachedFiles:
              0,
          };
        }

        const detached =
          await tx.file.updateMany(
            {
              where: {
                pdfFolderId: {
                  in: ids,
                },
              },

              data: {
                pdfFolderId:
                  null,
              },
            }
          );

        const deleted =
          await tx.pdfFolder.deleteMany(
            {
              where: {
                id: {
                  in: ids,
                },
              },
            }
          );

        return {
          deletedFolders:
            deleted.count,

          detachedFiles:
            detached.count,
        };
      }
    );

  return NextResponse.json({
    ok: true,
    ...result,
  });
}