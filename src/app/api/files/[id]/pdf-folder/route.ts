// src/app/api/files/[id]/pdf-folder/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  /**
   * Accept:
   *
   * null
   * ""
   * folder ID
   *
   * Empty string becomes null.
   */
  pdfFolderId: z.preprocess(
    (value) =>
      typeof value === "string" &&
      value.trim() === ""
        ? null
        : value,
    z.string().nullable()
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
  } = parsed.data;

  /**
   * Load the file together with
   * its assignments.
   *
   * This lets us determine which
   * USER owns this PDF.
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
        pdfFolderId: true,

        uploadedBy: {
          select: {
            id: true,
            role: true,
          },
        },

        assignments: {
          select: {
            userId: true,

            user: {
              select: {
                id: true,
                role: true,
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

  /**
   * Only PDFs may use PdfFolder.
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

  /**
   * Get unique normal-user
   * assignments.
   */
  const assignedUserIds =
    Array.from(
      new Set(
        file.assignments
          .filter(
            (assignment) =>
              assignment.user
                .role ===
              "USER"
          )
          .map(
            (assignment) =>
              assignment.userId
          )
      )
    );

  let targetUserId:
    | string
    | null = null;

  /**
   * -------------------------------------------------------
   * ADMIN
   * -------------------------------------------------------
   *
   * New PDFs should always have
   * exactly one assigned user.
   */
  if (isAdmin) {
    if (
      assignedUserIds.length >
      1
    ) {
      return json(
        {
          ok: false,
          error:
            "pdf_has_multiple_users",
          detail:
            "Το PDF είναι ανατεθειμένο σε περισσότερους από έναν χρήστες και δεν μπορεί να τοποθετηθεί σε προσωπικό φάκελο.",
        },
        409
      );
    }

    if (
      assignedUserIds.length ===
      1
    ) {
      targetUserId =
        assignedUserIds[0];
    } else if (
      file.uploadedBy &&
      file.uploadedBy.role ===
        "USER"
    ) {
      /**
       * Compatibility for an old
       * user-uploaded PDF that may
       * not have a FileAssignment.
       */
      targetUserId =
        file.uploadedBy.id;
    } else {
      return json(
        {
          ok: false,
          error:
            "pdf_has_no_user",
          detail:
            "Το PDF δεν είναι συνδεδεμένο με συγκεκριμένο χρήστη.",
        },
        409
      );
    }
  } else {
    /**
     * -----------------------------------------------------
     * NORMAL USER
     * -----------------------------------------------------
     *
     * The file must actually belong
     * to / be assigned to this user.
     */
    const assignedToMe =
      assignedUserIds.includes(
        meId
      );

    const uploadedByMe =
      file.uploadedById ===
      meId;

    if (
      !assignedToMe &&
      !uploadedByMe
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

    /**
     * Prevent an old PDF shared with
     * multiple users from being moved
     * by one user, because that would
     * change its folder for everyone.
     */
    if (
      assignedUserIds.length >
      1
    ) {
      return json(
        {
          ok: false,
          error:
            "pdf_has_multiple_users",
          detail:
            "Το PDF είναι κοινό σε περισσότερους από έναν χρήστες και δεν μπορεί να μετακινηθεί σε προσωπικό φάκελο.",
        },
        409
      );
    }

    /**
     * If it has one assignment,
     * that assignment must be this user.
     */
    if (
      assignedUserIds.length ===
        1 &&
      assignedUserIds[0] !==
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

  /**
   * -------------------------------------------------------
   * FOLDER VALIDATION
   * -------------------------------------------------------
   *
   * If null:
   * remove PDF from its folder.
   *
   * If ID:
   * folder MUST belong to the
   * resolved target user.
   */
  let folder:
    | {
        id: string;
        name: string;
        ownerId: string | null;
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

    /**
     * ownerId = null belongs to
     * the obsolete global-folder
     * architecture.
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

    /**
     * CRITICAL SECURITY RULE:
     *
     * The folder must belong to
     * the SAME user as the PDF.
     */
    if (
      folder.ownerId !==
      targetUserId
    ) {
      return json(
        {
          ok: false,
          error:
            "folder_owner_mismatch",
          detail:
            "Ο επιλεγμένος φάκελος δεν ανήκει στον χρήστη του PDF.",
        },
        403
      );
    }
  }

  /**
   * Update only after every
   * ownership check passed.
   */
  const updated =
    await prisma.file.update({
      where: {
        id: fileId,
      },

      data: {
        pdfFolderId,
      },

      select: {
        id: true,
        pdfFolderId: true,

        pdfFolder: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
      },
    });

  return json({
    ok: true,

    file: updated,

    targetUserId,

    folder:
      updated.pdfFolder,
  });
}