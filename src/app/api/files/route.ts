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
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const id = String(
            item || ""
          ).trim();

          if (id) {
            result.push(id);
          }
        }

        continue;
      }
    } catch {
      // Normal user ID.
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

/**
 * ---------------------------------------------------------
 * GET FILES
 * ---------------------------------------------------------
 *
 * Important:
 *
 * File.pdfFolderId is now legacy.
 *
 * New PDF folder placement comes from:
 *
 * FileAssignment.pdfFolderId
 *
 * For USER requests we expose the current user's assignment
 * folder as top-level pdfFolderId/pdfFolder so the existing
 * user frontend can continue using the same File shape.
 *
 * For ADMIN scope=all we also return all assignments and
 * their individual folder information.
 */
export async function GET(
  req: Request
) {
  const me =
    await currentUser();

  if (!me) {
    return NextResponse.json(
      {
        error: "unauthenticated",
      },
      {
        status: 401,
      }
    );
  }

  const meId = String(
    (me as any).id
  );

  const {
    searchParams,
  } = new URL(req.url);

  const scope =
    searchParams.get("scope");

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
        createdAt: "desc",
      },

      select: {
        id: true,
        title: true,
        originalName: true,
        url: true,
        mime: true,
        size: true,
        createdAt: true,

        // Legacy folder fields
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
          where: adminScope
            ? undefined
            : {
                userId: meId,
              },

          select: {
            id: true,
            userId: true,
            pdfFolderId: true,

            pdfFolder: {
              select: {
                id: true,
                name: true,
                ownerId: true,
              },
            },

            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

  const files =
    rawFiles.map((file) => {
      /*
       * ADMIN / scope=all
       *
       * A multi-user PDF does not have one single folder.
       * Each assignment has its own pdfFolderId.
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
       * Normal USER.
       *
       * Only their own assignment was selected above.
       */
      const myAssignment =
        file.assignments[0] ||
        null;

      /*
       * Legacy fallback only when the old
       * File folder actually belongs to this user.
       *
       * ownerId=null global folders are NOT exposed
       * as the user's folder.
       */
      const safeLegacyFolder =
        file.pdfFolder?.ownerId ===
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
    });

  return NextResponse.json(
    {
      files,
    },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

/**
 * ---------------------------------------------------------
 * POST FILE
 * ---------------------------------------------------------
 *
 * EXCEL / OTHER
 * ----------------
 * Works as before:
 *
 * assignTo = [user ids]
 * OR
 * assignTo = ALL
 *
 *
 * PDF - ONE USER
 * ----------------
 *
 * assignTo = [one user id]
 * pdfFolderId = that user's physical folder ID
 *
 *
 * PDF - ALL USERS
 * ----------------
 *
 * assignTo = ALL
 * pdfFolderName = logical folder name
 *
 * Example:
 *
 * assignTo = ALL
 * pdfFolderName = ΑΡΧΕΙΟ ΝΕΡΟΥ
 *
 * Result:
 *
 * ONE Supabase object
 * ONE File row
 *
 * FileAssignment User A
 *   -> User A's ΑΡΧΕΙΟ ΝΕΡΟΥ folder
 *
 * FileAssignment User B
 *   -> User B's ΑΡΧΕΙΟ ΝΕΡΟΥ folder
 *
 * etc.
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

  const meId = String(
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
        form.get("title") ||
          ""
      ).trim();

    /*
     * For ONE user:
     * physical folder ID.
     */
    const requestedPdfFolderId =
      String(
        form.get(
          "pdfFolderId"
        ) || ""
      ).trim() || null;

    /*
     * For ALL users:
     * logical/common folder name.
     */
    const requestedPdfFolderName =
      String(
        form.get(
          "pdfFolderName"
        ) || ""
      ).trim() || null;

    const rawOriginalName =
      file.name || "file";

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
      originalName.toLowerCase();

    const contentTypeRaw =
      file.type || "";

    const mime =
      contentTypeRaw ||
      (lower.endsWith(
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
            : "application/octet-stream");

    const isPdf =
      mime
        .toLowerCase()
        .includes("pdf") ||
      lower.endsWith(".pdf");

    /*
     * -----------------------------------------------------
     * ASSIGNMENTS
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
       * Normal users may only upload
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
              status:
                "ACTIVE",
              role: "USER",
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
       * Validate selected recipients.
       */
      const validUsers =
        await prisma.user.findMany(
          {
            where: {
              id: {
                in:
                  selectedUserIds,
              },

              role: "USER",

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
     * -----------------------------------------------------
     * PDF RECIPIENT RULE
     * -----------------------------------------------------
     *
     * PDF allows:
     *
     * - exactly ONE user
     * - ALL active users
     *
     * It does NOT allow arbitrary 2, 3, 4...
     * selected users because the UI requirement
     * is "specific user" or "all users".
     */
    if (isPdf) {
      if (
        selectedUserIds.length ===
        0
      ) {
        return errorResponse(
          "pdf_requires_user",
          400,
          "Επιλέξτε χρήστη ή όλους τους χρήστες."
        );
      }

      if (
        isAdmin &&
        !allRequested &&
        selectedUserIds.length !==
          1
      ) {
        return errorResponse(
          "pdf_requires_single_or_all",
          400,
          "Για PDF επιλέξτε έναν χρήστη ή όλους τους χρήστες."
        );
      }
    }

    /*
     * Folder fields make sense only for PDFs.
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
     * BUILD ASSIGNMENT ROWS
     * -----------------------------------------------------
     *
     * Each assignment can now have its own folder.
     */
    const assignmentRows: {
      userId: string;
      pdfFolderId: string | null;
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
     * PDF + ALL USERS
     * -----------------------------------------------------
     *
     * We resolve a logical folder NAME into
     * each user's physical folder ID.
     */
    if (
      isPdf &&
      allRequested &&
      (
        requestedPdfFolderName ||
        requestedPdfFolderId
      )
    ) {
      let logicalFolderName =
        requestedPdfFolderName;

      /*
       * Be tolerant if frontend sends a
       * representative folder ID.
       *
       * We derive its logical name first.
       */
      if (
        !logicalFolderName &&
        requestedPdfFolderId
      ) {
        const representativeFolder =
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

        if (
          !representativeFolder
        ) {
          return errorResponse(
            "folder_not_found",
            404
          );
        }

        if (
          !representativeFolder.ownerId
        ) {
          return errorResponse(
            "legacy_global_folder",
            409
          );
        }

        logicalFolderName =
          representativeFolder.name;
      }

      if (
        logicalFolderName
      ) {
        const personalFolders =
          await prisma.pdfFolder.findMany(
            {
              where: {
                ownerId: {
                  in:
                    selectedUserIds,
                },

                name:
                  logicalFolderName,
              },

              select: {
                id: true,
                name: true,
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

        const missingUsers =
          selectedUserIds.filter(
            (userId) =>
              !folderByUser.has(
                userId
              )
          );

        /*
         * ALL means ALL.
         *
         * If even one user lacks this logical
         * folder, stop rather than placing the
         * PDF inconsistently.
         */
        if (
          missingUsers.length >
          0
        ) {
          return errorResponse(
            "folder_missing_for_users",
            409,
            `Ο φάκελος "${logicalFolderName}" λείπει από ${missingUsers.length} ενεργό/ούς χρήστη/ες. Δημιουργήστε πρώτα τον φάκελο για όλους τους χρήστες.`
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
     * PDF + ONE USER
     * -----------------------------------------------------
     */
    if (
      isPdf &&
      !allRequested &&
      selectedUserIds.length ===
        1
    ) {
      const targetUserId =
        selectedUserIds[0];

      /*
       * Preferred single-user input:
       *
       * pdfFolderId
       */
      if (
        requestedPdfFolderId
      ) {
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
            "Ο επιλεγμένος φάκελος δεν ανήκει στον χρήστη του PDF."
          );
        }

        assignmentRows[0]
          .pdfFolderId =
          folder.id;
      } else if (
        requestedPdfFolderName
      ) {
        /*
         * Also support folder name for
         * convenience/compatibility.
         */
        const folder =
          await prisma.pdfFolder.findFirst(
            {
              where: {
                ownerId:
                  targetUserId,

                name:
                  requestedPdfFolderName,
              },

              select: {
                id: true,
                ownerId: true,
              },
            }
          );

        if (!folder) {
          return errorResponse(
            "folder_not_found",
            404,
            `Ο φάκελος "${requestedPdfFolderName}" δεν υπάρχει για τον επιλεγμένο χρήστη.`
          );
        }

        assignmentRows[0]
          .pdfFolderId =
          folder.id;
      }
    }

    /*
     * -----------------------------------------------------
     * STORAGE
     * -----------------------------------------------------
     *
     * IMPORTANT:
     *
     * This happens ONCE regardless of whether
     * the file is assigned to 1 or 100 users.
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
            upsert: false,
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
     * ONE File.
     *
     * MANY FileAssignments if ALL was selected.
     *
     * Each assignment can point to a different
     * physical PdfFolder row.
     *
     * New uploads DO NOT use File.pdfFolderId.
     * That column remains only for old/legacy data.
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
                   * Legacy field.
                   *
                   * All new PDF placement is stored
                   * on FileAssignment.pdfFolderId.
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

          const result =
            await tx.file.findUnique(
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
                          ownerId: true,
                        },
                      },
                    },
                  },
                },
              }
            );

          return result!;
        }
      );

    /*
     * For convenience:
     *
     * a one-user PDF gets its folder ID returned
     * at top level too.
     *
     * An ALL-users PDF has many different IDs,
     * therefore top-level pdfFolderId is null.
     */
    const responsePdfFolderId =
      isPdf &&
      created.assignments
        .length === 1
        ? created.assignments[0]
            .pdfFolderId
        : null;

    return NextResponse.json(
      {
        ok: true,

        file: {
          ...created,

          pdfFolderId:
            responsePdfFolderId,
        },

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

        pdfFolderId:
          responsePdfFolderId,

        /*
         * Helpful for ALL upload confirmation.
         */
        assignmentFolders:
          created.assignments.map(
            (assignment) => ({
              userId:
                assignment.userId,

              pdfFolderId:
                assignment.pdfFolderId,

              folderName:
                assignment.pdfFolder
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
     * Storage succeeded but DB failed:
     * remove the single orphaned object.
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