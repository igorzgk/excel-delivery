import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * ---------------------------------------------------------
 * SCHEMAS
 * ---------------------------------------------------------
 */

/*
 * Create folder for selected users.
 *
 * Examples:
 *
 * {
 *   name: "ΑΔΕΙΑ ΛΕΙΤΟΥΡΓΙΑΣ",
 *   userIds: ["user1", "user2", "user3"]
 * }
 *
 * OR:
 *
 * {
 *   name: "ΑΔΕΙΑ ΛΕΙΤΟΥΡΓΙΑΣ",
 *   all: true
 * }
 */
const CreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80),

    userIds: z
      .array(z.string().min(1))
      .optional(),

    all: z
      .boolean()
      .optional(),
  })
  .strict();

/*
 * Rename logical folder.
 *
 * This renames ONLY the users who
 * currently have the old folder.
 *
 * It does NOT add the folder to users
 * who do not already have it.
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

/*
 * Replace folder membership.
 *
 * The supplied userIds become the exact
 * list of users who should have this folder.
 */
const MembershipSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80),

    userIds: z
      .array(z.string().min(1)),
  })
  .strict();

/*
 * Delete logical folder completely.
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

/*
 * All normal application users.
 *
 * Folder management may include ACTIVE,
 * PENDING or SUSPENDED users.
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

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate",
  };
}

/*
 * ---------------------------------------------------------
 * GET
 * ---------------------------------------------------------
 *
 * Returns folders grouped by logical name.
 *
 * Example:
 *
 * User A -> ΑΔΕΙΑ ΛΕΙΤΟΥΡΓΙΑΣ -> folder_A
 * User B -> ΑΔΕΙΑ ΛΕΙΤΟΥΡΓΙΑΣ -> folder_B
 *
 * becomes:
 *
 * {
 *   name: "ΑΔΕΙΑ ΛΕΙΤΟΥΡΓΙΑΣ",
 *   count: 2,
 *   users: [...]
 * }
 *
 * ownerId = null legacy/global folders
 * are ignored.
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

        folderIds:
          string[];

        users: Array<{
          id: string;
          email: string;
          name:
            | string
            | null;
          status: string;
          folderId: string;
        }>;

        createdAt:
          Date;
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
            group.users.length,

          totalUsers,

          missingCount:
            Math.max(
              0,
              totalUsers -
                group.users.length
            ),

          complete:
            group.users.length ===
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
      headers:
        noStoreHeaders(),
    }
  );
}

/*
 * ---------------------------------------------------------
 * POST
 * ---------------------------------------------------------
 *
 * Create a logical folder for SELECTED users.
 *
 * Does NOT automatically create it for everybody.
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

  const {
    name,
    all,
  } = parsed.data;

  const requestedUserIds =
    Array.from(
      new Set(
        parsed.data.userIds ||
          []
      )
    );

  const users =
    await getNormalUsers();

  const validUserIds =
    new Set(
      users.map(
        (user) =>
          user.id
      )
    );

  let targetUserIds:
    string[];

  if (all === true) {
    targetUserIds =
      users.map(
        (user) =>
          user.id
      );
  } else {
    targetUserIds =
      requestedUserIds;
  }

  /*
   * Must choose at least one user.
   */
  if (
    targetUserIds.length ===
    0
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "no_users_selected",
        detail:
          "Επιλέξτε τουλάχιστον έναν χρήστη.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Reject ADMIN / unknown IDs.
   */
  const invalidUserIds =
    targetUserIds.filter(
      (id) =>
        !validUserIds.has(id)
    );

  if (
    invalidUserIds.length >
    0
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "invalid_user_ids",
        invalidUserIds,
      },
      {
        status: 400,
      }
    );
  }

  const existing =
    await prisma.pdfFolder.findMany(
      {
        where: {
          name,

          ownerId: {
            in:
              targetUserIds,
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
    targetUserIds.filter(
      (id) =>
        !existingOwnerIds.has(
          id
        )
    );

  if (
    missingIds.length >
    0
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

      name,

      created:
        missingIds.length,

      skipped:
        targetUserIds.length -
        missingIds.length,

      selectedUsers:
        targetUserIds.length,

      userIds:
        targetUserIds,
    },
    {
      status: 201,

      headers:
        noStoreHeaders(),
    }
  );
}

/*
 * ---------------------------------------------------------
 * PUT
 * ---------------------------------------------------------
 *
 * Set EXACT folder membership.
 *
 * Example:
 *
 * {
 *   name: "ΑΔΕΙΑ ΛΕΙΤΟΥΡΓΙΑΣ",
 *   userIds: [
 *     "userA",
 *     "userB",
 *     "userC"
 *   ]
 * }
 *
 * Those users will have the folder.
 *
 * Any other user who currently has this
 * folder will have their personal copy removed.
 *
 * PDFs are NOT deleted.
 *
 * Their FileAssignment.pdfFolderId becomes null.
 */
export async function PUT(
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
    MembershipSchema.safeParse(
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
    name,
  } = parsed.data;

  const requestedUserIds =
    Array.from(
      new Set(
        parsed.data.userIds
      )
    );

  const users =
    await getNormalUsers();

  const allUserIds =
    users.map(
      (user) =>
        user.id
    );

  const validUserIds =
    new Set(
      allUserIds
    );

  const invalidUserIds =
    requestedUserIds.filter(
      (id) =>
        !validUserIds.has(id)
    );

  if (
    invalidUserIds.length >
    0
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "invalid_user_ids",

        invalidUserIds,
      },
      {
        status: 400,
      }
    );
  }

  const selectedSet =
    new Set(
      requestedUserIds
    );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const existingFolders =
          await tx.pdfFolder.findMany(
            {
              where: {
                name,

                ownerId: {
                  in:
                    allUserIds,
                },
              },

              select: {
                id: true,
                ownerId: true,
              },
            }
          );

        const existingByOwner =
          new Map<
            string,
            string
          >();

        for (
          const folder of
          existingFolders
        ) {
          if (
            folder.ownerId
          ) {
            existingByOwner.set(
              folder.ownerId,
              folder.id
            );
          }
        }

        /*
         * Add folder to newly selected users.
         */
        const toAdd =
          requestedUserIds.filter(
            (userId) =>
              !existingByOwner.has(
                userId
              )
          );

        if (
          toAdd.length > 0
        ) {
          await tx.pdfFolder.createMany(
            {
              data:
                toAdd.map(
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

        /*
         * Remove folder copies from users
         * that are no longer selected.
         */
        const foldersToRemove =
          existingFolders.filter(
            (folder) =>
              !!folder.ownerId &&
              !selectedSet.has(
                folder.ownerId
              )
          );

        const removeFolderIds =
          foldersToRemove.map(
            (folder) =>
              folder.id
          );

        let detachedAssignments =
          0;

        let detachedLegacyFiles =
          0;

        let removedFolders =
          0;

        if (
          removeFolderIds.length >
          0
        ) {
          /*
           * NEW architecture.
           */
          const assignmentResult =
            await tx.fileAssignment.updateMany(
              {
                where: {
                  pdfFolderId: {
                    in:
                      removeFolderIds,
                  },
                },

                data: {
                  pdfFolderId:
                    null,
                },
              }
            );

          detachedAssignments =
            assignmentResult.count;

          /*
           * LEGACY architecture.
           *
           * Keep this until old File.pdfFolderId
           * data is fully migrated.
           */
          const legacyResult =
            await tx.file.updateMany(
              {
                where: {
                  pdfFolderId: {
                    in:
                      removeFolderIds,
                  },
                },

                data: {
                  pdfFolderId:
                    null,
                },
              }
            );

          detachedLegacyFiles =
            legacyResult.count;

          const deleted =
            await tx.pdfFolder.deleteMany(
              {
                where: {
                  id: {
                    in:
                      removeFolderIds,
                  },
                },
              }
            );

          removedFolders =
            deleted.count;
        }

        return {
          added:
            toAdd.length,

          removed:
            removedFolders,

          detachedAssignments,

          detachedLegacyFiles,
        };
      }
    );

  return NextResponse.json(
    {
      ok: true,

      name,

      selectedUsers:
        requestedUserIds.length,

      userIds:
        requestedUserIds,

      ...result,
    },
    {
      headers:
        noStoreHeaders(),
    }
  );
}

/*
 * ---------------------------------------------------------
 * PATCH
 * ---------------------------------------------------------
 *
 * Rename folder.
 *
 * IMPORTANT:
 *
 * Only users who ALREADY have oldName
 * are affected.
 *
 * We do NOT create the folder for users
 * who did not have it.
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
    return NextResponse.json({
      ok: true,
      renamed: 0,
      merged: 0,
    });
  }

  const users =
    await getNormalUsers();

  const userIds =
    users.map(
      (user) =>
        user.id
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
                  in:
                    userIds,
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

            movedAssignments:
              0,

            movedLegacyFiles:
              0,
          };
        }

        const ownersWithOldFolder =
          oldFolders
            .map(
              (folder) =>
                folder.ownerId
            )
            .filter(
              (
                id
              ): id is string =>
                !!id
            );

        const targetFolders =
          await tx.pdfFolder.findMany(
            {
              where: {
                name:
                  newName,

                ownerId: {
                  in:
                    ownersWithOldFolder,
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

        let movedAssignments =
          0;

        let movedLegacyFiles =
          0;

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

          /*
           * User already has newName.
           *
           * Merge old folder into target.
           */
          if (targetId) {
            const assignments =
              await tx.fileAssignment.updateMany(
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

            movedAssignments +=
              assignments.count;

            const legacyFiles =
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

            movedLegacyFiles +=
              legacyFiles.count;

            await tx.pdfFolder.delete(
              {
                where: {
                  id:
                    folder.id,
                },
              }
            );

            merged += 1;

            continue;
          }

          /*
           * Normal rename.
           */
          await tx.pdfFolder.update(
            {
              where: {
                id:
                  folder.id,
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

        return {
          notFound:
            false,

          renamed,

          merged,

          movedAssignments,

          movedLegacyFiles,
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

  return NextResponse.json(
    {
      ok: true,

      renamed:
        result.renamed,

      merged:
        result.merged,

      movedAssignments:
        result.movedAssignments,

      movedLegacyFiles:
        result.movedLegacyFiles,
    },
    {
      headers:
        noStoreHeaders(),
    }
  );
}

/*
 * ---------------------------------------------------------
 * DELETE
 * ---------------------------------------------------------
 *
 * Delete this logical folder from EVERY
 * user who currently has it.
 *
 * PDFs themselves are NOT deleted.
 *
 * Both:
 *
 * FileAssignment.pdfFolderId
 * File.pdfFolderId (legacy)
 *
 * are detached first.
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
      (user) =>
        user.id
    );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const folders =
          await tx.pdfFolder.findMany(
            {
              where: {
                name:
                  parsed.data.name,

                ownerId: {
                  in:
                    userIds,
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

            detachedAssignments:
              0,

            detachedLegacyFiles:
              0,
          };
        }

        /*
         * New architecture.
         */
        const detachedAssignments =
          await tx.fileAssignment.updateMany(
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

        /*
         * Legacy architecture.
         */
        const detachedLegacyFiles =
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

          detachedAssignments:
            detachedAssignments.count,

          detachedLegacyFiles:
            detachedLegacyFiles.count,
        };
      }
    );

  return NextResponse.json(
    {
      ok: true,
      ...result,
    },
    {
      headers:
        noStoreHeaders(),
    }
  );
}