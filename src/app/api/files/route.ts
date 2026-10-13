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
      .startsWith(
        prefix.toLowerCase()
      )
  ) {
    return filename.slice(
      prefix.length
    );
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

  const {
    searchParams,
  } = new URL(req.url);

  const scope =
    searchParams.get("scope");

  const isAdmin =
    (me as any).role ===
      "ADMIN" &&
    scope === "all";

  /**
   * ADMIN + scope=all:
   * all files.
   *
   * USER:
   * files uploaded by themselves
   * OR assigned to themselves.
   */
  const where =
    isAdmin
      ? undefined
      : {
          OR: [
            {
              uploadedById:
                (me as any).id,
            },
            {
              assignments: {
                some: {
                  userId:
                    (me as any)
                      .id,
                },
              },
            },
          ],
        };

  const files =
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
        pdfFolderId: true,

        /**
         * Useful for validating /
         * displaying PDF ownership.
         */
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

        ...(isAdmin
          ? {
              assignments: {
                select: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                    },
                  },
                },
              },
            }
          : {}),
      },
    });

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
 * Excel / other:
 *   may be assigned to multiple users.
 *
 * PDF:
 *   must belong to exactly ONE user.
 *
 * Optional FormData:
 *
 * pdfFolderId
 *
 * If supplied for a PDF, the folder MUST
 * belong to the same user receiving the PDF.
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

    /**
     * PDF folder is sent directly
     * during upload now.
     */
    const requestedPdfFolderId =
      String(
        form.get(
          "pdfFolderId"
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

    /**
     * Determine MIME before we
     * validate PDF-specific rules.
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

    let selectedUserIds =
      parseSelectedUserIds(
        form
      );

    /**
     * -----------------------------------------------------
     * RESOLVE ASSIGNMENTS
     * -----------------------------------------------------
     */
    if (!isAdmin) {
      /**
       * A normal user can only
       * upload for themselves.
       */
      selectedUserIds = [
        meId,
      ];
    } else if (
      selectedUserIds.includes(
        "ALL"
      )
    ) {
      /**
       * ALL keeps its previous
       * behavior for non-PDF files.
       */
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
          (user) => user.id
        );
    } else if (
      selectedUserIds.length >
      0
    ) {
      /**
       * Validate supplied IDs.
       *
       * Only ACTIVE normal users
       * may receive uploaded files.
       */
      const validUsers =
        await prisma.user.findMany(
          {
            where: {
              id: {
                in: selectedUserIds,
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

    /**
     * -----------------------------------------------------
     * PDF RULE
     * -----------------------------------------------------
     *
     * A PDF File has only ONE:
     *
     * pdfFolderId
     *
     * Therefore a PDF must belong
     * to exactly ONE user.
     *
     * If the same PDF is needed
     * for several users, the admin
     * uploads a separate File copy
     * for each user.
     */
    if (
      isPdf &&
      selectedUserIds.length !==
        1
    ) {
      return errorResponse(
        "pdf_requires_single_user",
        400,
        "Ένα PDF πρέπει να ανατεθεί σε έναν μόνο χρήστη."
      );
    }

    /**
     * -----------------------------------------------------
     * VALIDATE PDF FOLDER
     * -----------------------------------------------------
     */
    let pdfFolderId:
      | string
      | null = null;

    if (
      requestedPdfFolderId
    ) {
      /**
       * Only PDFs can be put in
       * PdfFolder.
       */
      if (!isPdf) {
        return errorResponse(
          "pdf_folder_only_for_pdf",
          400
        );
      }

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

      /**
       * ownerId = null is the old
       * global-folder system.
       *
       * It must never be used for
       * new PDF uploads.
       */
      if (!folder.ownerId) {
        return errorResponse(
          "legacy_global_folder",
          409
        );
      }

      const targetUserId =
        selectedUserIds[0];

      /**
       * This is the critical
       * ownership validation:
       *
       * User A's file cannot be
       * put into User B's folder.
       */
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

      pdfFolderId =
        folder.id;
    }

    /**
     * -----------------------------------------------------
     * STORAGE
     * -----------------------------------------------------
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

    /**
     * -----------------------------------------------------
     * DATABASE
     * -----------------------------------------------------
     *
     * File + assignment + PDF folder
     * are created together.
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

                  pdfFolderId,
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
                  pdfFolderId:
                    true,

                  pdfFolder: {
                    select: {
                      id: true,
                      name: true,
                      ownerId:
                        true,
                    },
                  },
                },
              }
            );

          if (
            selectedUserIds.length >
            0
          ) {
            await tx.fileAssignment.createMany(
              {
                data:
                  selectedUserIds.map(
                    (
                      userId
                    ) => ({
                      fileId:
                        createdFile.id,

                      userId,

                      assignedById:
                        meId,
                    })
                  ),

                skipDuplicates:
                  true,
              }
            );
          }

          return createdFile;
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
          selectedUserIds.length,

        assignedUserIds:
          selectedUserIds,

        pdfFolderId:
          created.pdfFolderId,
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

    /**
     * Storage succeeded but DB failed:
     * remove orphaned object.
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