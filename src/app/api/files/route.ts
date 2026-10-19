import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth-helpers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY!;

const BUCKET =
  process.env.SUPABASE_BUCKET || "Files";

function supabaseAdmin() {
  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function safeFilename(name: string) {
  return (name || "file").replace(
    /[^\w.\-() ]+/g,
    "_"
  );
}

function removeUserEmailPrefix(
  filename: string,
  email?: string | null
) {
  if (!email) {
    return filename;
  }

  const prefix = `${email}_`;

  if (
    filename
      .toLowerCase()
      .startsWith(prefix.toLowerCase())
  ) {
    return filename.slice(prefix.length);
  }

  return filename;
}

function parseSelectedUserIds(
  form: FormData
): string[] {
  const values = form
    .getAll("assignTo")
    .map((value) =>
      String(value || "").trim()
    )
    .filter(Boolean);

  const result: string[] = [];

  for (const value of values) {
    if (value === "ALL") {
      result.push("ALL");
      continue;
    }

    try {
      const parsed =
        JSON.parse(value);

      if (
        Array.isArray(parsed)
      ) {
        for (
          const item of parsed
        ) {
          const id =
            String(
              item || ""
            ).trim();

          if (id) {
            result.push(id);
          }
        }

        continue;
      }
    } catch {
      // Normal single ID
    }

    result.push(value);
  }

  return Array.from(
    new Set(result)
  );
}

function errorResponse(
  error: string,
  status: number,
  detail?: any
) {
  return NextResponse.json(
    {
      ok: false,
      error,

      ...(detail !== undefined
        ? { detail }
        : {}),
    },
    {
      status,
    }
  );
}

/*
 * ---------------------------------------------------------
 * GET
 * ---------------------------------------------------------
 *
 * New PDF folder placement:
 *
 * FileAssignment.pdfFolderId
 *
 * File.pdfFolderId remains only as
 * legacy compatibility.
 */
export async function GET(
  req: Request
) {
  const me =
    await currentUser();

  if (!me) {
    return NextResponse.json(
      {
        error:
          "unauthenticated",
      },
      {
        status: 401,
      }
    );
  }

  const meId =
    String(
      (me as any).id
    );

  const {
    searchParams,
  } = new URL(req.url);

  const scope =
    searchParams.get(
      "scope"
    );

  const adminScope =
    (me as any).role ===
      "ADMIN" &&
    scope === "all";

  const where =
    adminScope
      ? undefined
      : {
          OR: [
            {
              uploadedById:
                meId,
            },

            {
              assignments: {
                some: {
                  userId:
                    meId,
                },
              },
            },
          ],
        };

  const rawFiles =
    await prisma.file.findMany({
      where,

      orderBy: {
        createdAt:
          "desc",
      },

      select: {
        id: true,
        title: true,
        originalName: true,
        url: true,
        mime: true,
        size: true,
        createdAt: true,

        /*
         * Legacy
         */
        pdfFolderId: true,

        pdfFolder: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },

        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        assignments: {
          where:
            adminScope
              ? undefined
              : {
                  userId:
                    meId,
                },

          select: {
            id: true,
            userId: true,
            pdfFolderId:
              true,

            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },

            pdfFolder: {
              select: {
                id: true,
                name: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

  const files =
    rawFiles.map(
      (file) => {
        /*
         * Admin needs ALL assignment
         * information because the same
         * PDF may belong to many users.
         */
        if (adminScope) {
          const singleAssignment =
            file.assignments.length ===
            1
              ? file.assignments[0]
              : null;

          const safeLegacyFolder =
            file.assignments.length ===
              0 &&
            file.pdfFolder?.ownerId
              ? file.pdfFolder
              : null;

          return {
            ...file,

            pdfFolderId:
              singleAssignment
                ?.pdfFolderId ??
              safeLegacyFolder
                ?.id ??
              null,

            pdfFolder:
              singleAssignment
                ?.pdfFolder ??
              safeLegacyFolder ??
              null,
          };
        }

        /*
         * Normal user only gets their
         * own assignment folder.
         */
        const myAssignment =
          file.assignments[0] ||
          null;

        const safeLegacyFolder =
          file.pdfFolder
            ?.ownerId ===
          meId
            ? file.pdfFolder
            : null;

        const {
          assignments,
          ...rest
        } = file;

        return {
          ...rest,

          pdfFolderId:
            myAssignment
              ?.pdfFolderId ??
            safeLegacyFolder
              ?.id ??
            null,

          pdfFolder:
            myAssignment
              ?.pdfFolder ??
            safeLegacyFolder ??
            null,
        };
      }
    );

  return NextResponse.json(
    {
      files,
    },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",

        Pragma:
          "no-cache",

        Expires:
          "0",
      },
    }
  );
}

/*
 * ---------------------------------------------------------
 * POST
 * ---------------------------------------------------------
 *
 * EXCEL / OTHER:
 *
 * assignTo = selected IDs
 * OR assignTo = ALL
 *
 *
 * PDF:
 *
 * assignTo = selected IDs
 * OR assignTo = ALL
 *
 * pdfFolderName =
 * logical/common folder name.
 *
 *
 * Example:
 *
 * assignTo:
 * [
 *   userA,
 *   userB,
 *   userC
 * ]
 *
 * pdfFolderName:
 * "ΑΔΕΙΑ ΛΕΙΤΟΥΡΓΙΑΣ"
 *
 *
 * Result:
 *
 * ONE File
 * ONE Supabase object
 *
 * Assignment A
 * -> User A
 * -> User A's folder ID
 *
 * Assignment B
 * -> User B
 * -> User B's folder ID
 *
 * Assignment C
 * -> User C
 * -> User C's folder ID
 */
export async function POST(
  req: Request
) {
  const me =
    await currentUser();

  if (!me) {
    return NextResponse.json(
      {
        error:
          "unauthenticated",
      },
      {
        status: 401,
      }
    );
  }

  const meId =
    String(
      (me as any).id
    );

  const isAdmin =
    (me as any).role ===
    "ADMIN";

  let uploadedStorageKey:
    | string
    | null = null;

  try {
    const form =
      await req.formData();

    const file =
      form.get(
        "file"
      ) as File | null;

    if (!file) {
      return errorResponse(
        "missing_file",
        400
      );
    }

    const suppliedTitle =
      String(
        form.get(
          "title"
        ) || ""
      ).trim();

    /*
     * Physical folder ID.
     *
     * Mainly compatibility for
     * one-user PDF uploads.
     */
    const requestedPdfFolderId =
      String(
        form.get(
          "pdfFolderId"
        ) || ""
      ).trim() || null;

    /*
     * Logical folder name.
     *
     * Recommended for any PDF
     * recipient selection.
     */
    const requestedPdfFolderName =
      String(
        form.get(
          "pdfFolderName"
        ) || ""
      ).trim() || null;

    const rawOriginalName =
      file.name ||
      "file";

    const cleanedOriginalName =
      removeUserEmailPrefix(
        rawOriginalName,
        (me as any).email
      );

    const originalName =
      safeFilename(
        cleanedOriginalName
      );

    const title =
      suppliedTitle ||
      originalName.replace(
        /\.[^/.]+$/,
        ""
      );

    if (!title) {
      return errorResponse(
        "missing_title",
        400
      );
    }

    /*
     * -----------------------------------------------------
     * MIME
     * -----------------------------------------------------
     */
    const lower =
      originalName
        .toLowerCase();

    const contentTypeRaw =
      file.type || "";

    const mime =
      contentTypeRaw ||
      (
        lower.endsWith(
          ".pdf"
        )
          ? "application/pdf"
          : lower.endsWith(
                ".xlsx"
              )
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : lower.endsWith(
                  ".xls"
                )
              ? "application/vnd.ms-excel"
              : "application/octet-stream"
      );

    const isPdf =
      mime
        .toLowerCase()
        .includes(
          "pdf"
        ) ||
      lower.endsWith(
        ".pdf"
      );

    /*
     * -----------------------------------------------------
     * RECIPIENTS
     * -----------------------------------------------------
     */
    let selectedUserIds =
      parseSelectedUserIds(
        form
      );

    const allRequested =
      isAdmin &&
      selectedUserIds.includes(
        "ALL"
      );

    if (!isAdmin) {
      /*
       * Normal user uploads only
       * for themselves.
       */
      selectedUserIds = [
        meId,
      ];
    } else if (
      allRequested
    ) {
      const allActiveUsers =
        await prisma.user.findMany(
          {
            where: {
              role:
                "USER",

              status:
                "ACTIVE",
            },

            select: {
              id: true,
            },
          }
        );

      selectedUserIds =
        allActiveUsers.map(
          (user) =>
            user.id
        );
    } else if (
      selectedUserIds.length >
      0
    ) {
      /*
       * Validate selected IDs.
       *
       * Only ACTIVE users receive
       * uploaded files.
       */
      const validUsers =
        await prisma.user.findMany(
          {
            where: {
              id: {
                in:
                  selectedUserIds,
              },

              role:
                "USER",

              status:
                "ACTIVE",
            },

            select: {
              id: true,
            },
          }
        );

      selectedUserIds =
        validUsers.map(
          (user) =>
            user.id
        );
    }

    selectedUserIds =
      Array.from(
        new Set(
          selectedUserIds
        )
      );

    /*
     * PDF must have at least one
     * recipient.
     */
    if (
      isPdf &&
      selectedUserIds.length ===
        0
    ) {
      return errorResponse(
        "pdf_requires_user",
        400,
        "Επιλέξτε τουλάχιστον έναν χρήστη."
      );
    }

    /*
     * Folder parameters only make
     * sense for PDFs.
     */
    if (
      !isPdf &&
      (
        requestedPdfFolderId ||
        requestedPdfFolderName
      )
    ) {
      return errorResponse(
        "pdf_folder_only_for_pdf",
        400
      );
    }

    /*
     * -----------------------------------------------------
     * ASSIGNMENT ROWS
     * -----------------------------------------------------
     */
    const assignmentRows:
      {
        userId: string;
        pdfFolderId:
          | string
          | null;
      }[] =
      selectedUserIds.map(
        (userId) => ({
          userId,
          pdfFolderId:
            null,
        })
      );

    /*
     * -----------------------------------------------------
     * PDF FOLDER RESOLUTION
     * -----------------------------------------------------
     *
     * For multiple selected users we
     * resolve the SAME logical folder
     * name separately for each user.
     */
    if (
      isPdf &&
      selectedUserIds.length >
        0
    ) {
      let logicalFolderName =
        requestedPdfFolderName;

      /*
       * Compatibility:
       *
       * If frontend sent one physical
       * folder ID and there is one user,
       * validate and use it.
       */
      if (
        requestedPdfFolderId &&
        selectedUserIds.length ===
          1
      ) {
        const targetUserId =
          selectedUserIds[0];

        const folder =
          await prisma.pdfFolder.findUnique(
            {
              where: {
                id:
                  requestedPdfFolderId,
              },

              select: {
                id: true,
                name: true,
                ownerId: true,
              },
            }
          );

        if (!folder) {
          return errorResponse(
            "folder_not_found",
            404
          );
        }

        if (
          !folder.ownerId
        ) {
          return errorResponse(
            "legacy_global_folder",
            409
          );
        }

        if (
          folder.ownerId !==
          targetUserId
        ) {
          return errorResponse(
            "folder_owner_mismatch",
            403,
            "Ο επιλεγμένος φάκελος δεν ανήκει στον συγκεκριμένο χρήστη."
          );
        }

        assignmentRows[0]
          .pdfFolderId =
          folder.id;

        logicalFolderName =
          folder.name;
      }

      /*
       * If a logical folder name is
       * supplied, EVERY selected user
       * must have their own copy of it.
       */
      if (
        logicalFolderName
      ) {
        const personalFolders =
          await prisma.pdfFolder.findMany(
            {
              where: {
                name:
                  logicalFolderName,

                ownerId: {
                  in:
                    selectedUserIds,
                },
              },

              select: {
                id: true,
                ownerId: true,
              },
            }
          );

        const folderByUser =
          new Map<
            string,
            string
          >();

        for (
          const folder of
          personalFolders
        ) {
          if (
            folder.ownerId
          ) {
            folderByUser.set(
              folder.ownerId,
              folder.id
            );
          }
        }

        const missingUserIds =
          selectedUserIds.filter(
            (userId) =>
              !folderByUser.has(
                userId
              )
          );

        if (
          missingUserIds.length >
          0
        ) {
          return errorResponse(
            "folder_missing_for_selected_users",
            409,
            `Ο φάκελος "${logicalFolderName}" δεν υπάρχει για ${missingUserIds.length} από τους επιλεγμένους χρήστες.`
          );
        }

        for (
          const row of
          assignmentRows
        ) {
          row.pdfFolderId =
            folderByUser.get(
              row.userId
            ) || null;
        }
      }
    }

    /*
     * -----------------------------------------------------
     * STORAGE
     * -----------------------------------------------------
     *
     * ONE upload regardless of
     * recipient count.
     */
    const buffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    const dotIndex =
      originalName.lastIndexOf(
        "."
      );

    const extension =
      dotIndex >= 0
        ? originalName
            .slice(dotIndex)
            .toLowerCase()
        : "";

    const storageKey =
      `${crypto.randomUUID()}${extension}`;

    uploadedStorageKey =
      storageKey;

    const supabase =
      supabaseAdmin();

    const uploadResult =
      await supabase.storage
        .from(BUCKET)
        .upload(
          storageKey,
          buffer,
          {
            contentType:
              mime,

            upsert:
              false,
          }
        );

    if (
      uploadResult.error
    ) {
      console.error(
        "Supabase upload failed:",
        uploadResult.error
      );

      return NextResponse.json(
        {
          error:
            "upload_failed",

          detail:
            uploadResult
              .error
              .message,

          bucket:
            BUCKET,
        },
        {
          status: 500,
        }
      );
    }

    const url =
      `/api/files/download/${encodeURIComponent(
        storageKey
      )}`;

    /*
     * -----------------------------------------------------
     * DATABASE
     * -----------------------------------------------------
     *
     * ONE File
     * MANY FileAssignments
     *
     * Each assignment may have
     * its own PdfFolder ID.
     */
    const created =
      await prisma.$transaction(
        async (tx) => {
          const createdFile =
            await tx.file.create(
              {
                data: {
                  title,
                  originalName,
                  url,
                  mime,

                  size:
                    buffer.length,

                  uploadedById:
                    meId,

                  /*
                   * New uploads do not use
                   * File.pdfFolderId.
                   */
                  pdfFolderId:
                    null,
                },

                select: {
                  id: true,
                  title: true,
                  originalName:
                    true,
                  url: true,
                  mime: true,
                  size: true,
                  createdAt:
                    true,
                },
              }
            );

          if (
            assignmentRows.length >
            0
          ) {
            await tx.fileAssignment.createMany(
              {
                data:
                  assignmentRows.map(
                    (row) => ({
                      fileId:
                        createdFile.id,

                      userId:
                        row.userId,

                      assignedById:
                        meId,

                      pdfFolderId:
                        isPdf
                          ? row.pdfFolderId
                          : null,
                    })
                  ),

                skipDuplicates:
                  true,
              }
            );
          }

          return tx.file.findUniqueOrThrow(
            {
              where: {
                id:
                  createdFile.id,
              },

              select: {
                id: true,
                title: true,
                originalName:
                  true,
                url: true,
                mime: true,
                size: true,
                createdAt:
                  true,

                assignments: {
                  select: {
                    id: true,
                    userId: true,
                    pdfFolderId:
                      true,

                    user: {
                      select: {
                        id: true,
                        email: true,
                        name: true,
                      },
                    },

                    pdfFolder: {
                      select: {
                        id: true,
                        name: true,
                        ownerId:
                          true,
                      },
                    },
                  },
                },
              },
            }
          );
        }
      );

    return NextResponse.json(
      {
        ok: true,

        file:
          created,

        id:
          created.id,

        assignedCount:
          created.assignments
            .length,

        assignedUserIds:
          created.assignments.map(
            (assignment) =>
              assignment.userId
          ),

        assignmentFolders:
          created.assignments.map(
            (assignment) => ({
              userId:
                assignment.userId,

              pdfFolderId:
                assignment.pdfFolderId,

              folderName:
                assignment
                  .pdfFolder
                  ?.name ??
                null,
            })
          ),
      },
      {
        status: 201,
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "POST /api/files failed:",
      error
    );

    /*
     * DB failed after upload:
     * remove orphaned storage object.
     */
    if (
      uploadedStorageKey
    ) {
      try {
        await supabaseAdmin()
          .storage
          .from(BUCKET)
          .remove([
            uploadedStorageKey,
          ]);
      } catch (
        cleanupError
      ) {
        console.error(
          "Could not remove orphaned storage object:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "server_error",

        detail:
          error?.message ||
          "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}