// src/app/api/files/[id]/pdf-folder/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  pdfFolderId: z.preprocess(
    (value) =>
      typeof value === "string" &&
      value.trim() === ""
        ? null
        : value,
    z.string().nullable()
  ),

  // Admin sends this so we know WHICH user's
  // assignment is being moved.
  userId: z.preprocess(
    (value) =>
      typeof value === "string" &&
      value.trim() === ""
        ? null
        : value,
    z.string().nullable().optional()
  ),
});

function json(
  body: object,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    }
  );
}

export async function PATCH(
  req: Request,
  ctx: {
    params: {
      id: string;
    };
  }
) {
  const me =
    await currentUser();

  if (!me) {
    return json(
      {
        ok: false,
        error: "unauthorized",
      },
      401
    );
  }

  const meId =
    String((me as any).id);

  const isAdmin =
    (me as any).role ===
    "ADMIN";

  const fileId =
    ctx.params.id;

  const body =
    await req
      .json()
      .catch(() => ({}));

  const parsed =
    BodySchema.safeParse(
      body
    );

  if (!parsed.success) {
    return json(
      {
        ok: false,
        error:
          "invalid_payload",
        detail:
          parsed.error.flatten(),
      },
      400
    );
  }

  const {
    pdfFolderId,
    userId:
      requestedUserId,
  } = parsed.data;

  /*
   * -------------------------------------------------------
   * LOAD FILE
   * -------------------------------------------------------
   */
  const file =
    await prisma.file.findUnique({
      where: {
        id: fileId,
      },

      select: {
        id: true,
        mime: true,
        originalName: true,

        uploadedById: true,

        // Legacy field
        pdfFolderId: true,

        uploadedBy: {
          select: {
            id: true,
            role: true,
          },
        },

        assignments: {
          select: {
            id: true,
            userId: true,
            pdfFolderId: true,

            user: {
              select: {
                id: true,
                role: true,
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

  if (!file) {
    return json(
      {
        ok: false,
        error: "not_found",
      },
      404
    );
  }

  /*
   * -------------------------------------------------------
   * PDF CHECK
   * -------------------------------------------------------
   */
  const isPdf =
    (
      file.mime || ""
    )
      .toLowerCase()
      .includes("pdf") ||
    (
      file.originalName ||
      ""
    )
      .toLowerCase()
      .endsWith(".pdf");

  if (!isPdf) {
    return json(
      {
        ok: false,
        error: "not_pdf",
      },
      400
    );
  }

  /*
   * -------------------------------------------------------
   * LOAD DESTINATION FOLDER
   * -------------------------------------------------------
   */
  let folder:
    | {
        id: string;
        name: string;
        ownerId:
          | string
          | null;
      }
    | null = null;

  if (pdfFolderId) {
    folder =
      await prisma.pdfFolder.findUnique(
        {
          where: {
            id:
              pdfFolderId,
          },

          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        }
      );

    if (!folder) {
      return json(
        {
          ok: false,
          error:
            "folder_not_found",
        },
        404
      );
    }

    /*
     * Never use old global folders.
     */
    if (!folder.ownerId) {
      return json(
        {
          ok: false,
          error:
            "legacy_global_folder",
          detail:
            "Ο παλιός κοινόχρηστος φάκελος δεν μπορεί να χρησιμοποιηθεί.",
        },
        409
      );
    }
  }

  /*
   * -------------------------------------------------------
   * RESOLVE TARGET USER
   * -------------------------------------------------------
   *
   * NORMAL USER:
   * always themselves.
   *
   * ADMIN:
   *
   * 1. userId from request
   * 2. destination folder owner
   * 3. single assignment
   * 4. legacy uploader fallback
   */
  let targetUserId:
    | string
    | null = null;

  if (!isAdmin) {
    /*
     * Normal users can only move
     * their own assignment.
     */
    if (
      requestedUserId &&
      requestedUserId !==
        meId
    ) {
      return json(
        {
          ok: false,
          error:
            "forbidden",
        },
        403
      );
    }

    targetUserId =
      meId;
  } else {
    if (
      requestedUserId
    ) {
      targetUserId =
        requestedUserId;
    } else if (
      folder?.ownerId
    ) {
      /*
       * If moving INTO a folder,
       * its owner tells us which
       * user's assignment to update.
       */
      targetUserId =
        folder.ownerId;
    } else {
      const normalAssignments =
        file.assignments.filter(
          (assignment) =>
            assignment.user
              .role ===
            "USER"
        );

      if (
        normalAssignments.length ===
        1
      ) {
        targetUserId =
          normalAssignments[0]
            .userId;
      } else if (
        normalAssignments.length ===
          0 &&
        file.uploadedBy?.role ===
          "USER"
      ) {
        /*
         * Legacy user-uploaded file.
         */
        targetUserId =
          file.uploadedBy.id;
      } else {
        /*
         * Shared PDF + move to root:
         *
         * Folder is null, so admin MUST
         * specify which user is being changed.
         */
        return json(
          {
            ok: false,
            error:
              "target_user_required",
            detail:
              "Για κοινό PDF πρέπει να καθοριστεί ο χρήστης του οποίου η θέση φακέλου θα αλλάξει.",
          },
          400
        );
      }
    }
  }

  if (!targetUserId) {
    return json(
      {
        ok: false,
        error:
          "user_not_resolved",
      },
      409
    );
  }

  /*
   * -------------------------------------------------------
   * DESTINATION FOLDER OWNERSHIP
   * -------------------------------------------------------
   */
  if (
    folder &&
    folder.ownerId !==
      targetUserId
  ) {
    return json(
      {
        ok: false,
        error:
          "folder_owner_mismatch",
        detail:
          "Ο επιλεγμένος φάκελος δεν ανήκει στον συγκεκριμένο χρήστη.",
      },
      403
    );
  }

  /*
   * -------------------------------------------------------
   * FIND TARGET ASSIGNMENT
   * -------------------------------------------------------
   */
  const existingAssignment =
    file.assignments.find(
      (assignment) =>
        assignment.userId ===
          targetUserId &&
        assignment.user.role ===
          "USER"
    ) || null;

  /*
   * Normal user must actually have access.
   *
   * Legacy exception:
   * a user-uploaded file may not have an
   * assignment yet.
   */
  if (
    !isAdmin &&
    !existingAssignment &&
    file.uploadedById !==
      meId
  ) {
    return json(
      {
        ok: false,
        error:
          "forbidden",
      },
      403
    );
  }

  /*
   * Admin also cannot arbitrarily attach
   * an existing file to some unrelated user.
   *
   * That must happen through the assignment API.
   */
  if (
    isAdmin &&
    !existingAssignment &&
    file.uploadedById !==
      targetUserId
  ) {
    return json(
      {
        ok: false,
        error:
          "file_not_assigned_to_user",
        detail:
          "Το αρχείο δεν είναι ανατεθειμένο στον συγκεκριμένο χρήστη.",
      },
      409
    );
  }

  /*
   * -------------------------------------------------------
   * UPDATE ASSIGNMENT FOLDER
   * -------------------------------------------------------
   *
   * If a legacy user-uploaded PDF has no
   * FileAssignment, create one now.
   *
   * We also clear File.pdfFolderId because
   * folder placement now belongs exclusively
   * to FileAssignment.
   */
  const result =
    await prisma.$transaction(
      async (tx) => {
        let assignment;

        if (
          existingAssignment
        ) {
          assignment =
            await tx.fileAssignment.update(
              {
                where: {
                  id:
                    existingAssignment.id,
                },

                data: {
                  pdfFolderId,
                },

                select: {
                  id: true,
                  fileId: true,
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
              }
            );
        } else {
          /*
           * Legacy compatibility:
           *
           * file was uploaded by this USER
           * but has no FileAssignment yet.
           */
          assignment =
            await tx.fileAssignment.create(
              {
                data: {
                  fileId,
                  userId:
                    targetUserId,

                  assignedById:
                    meId,

                  pdfFolderId,
                },

                select: {
                  id: true,
                  fileId: true,
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
              }
            );
        }

        /*
         * Remove old File-level folder placement.
         *
         * We do NOT delete any folder or PDF.
         */
        if (
          file.pdfFolderId
        ) {
          await tx.file.update({
            where: {
              id: fileId,
            },

            data: {
              pdfFolderId:
                null,
            },
          });
        }

        return assignment;
      }
    );

  return json({
    ok: true,

    file: {
      id: fileId,

      /*
       * Compatibility with existing frontend
       * File shape.
       */
      pdfFolderId:
        result.pdfFolderId,

      pdfFolder:
        result.pdfFolder,
    },

    assignment:
      result,

    targetUserId:
      result.userId,

    folder:
      result.pdfFolder,
  });
}