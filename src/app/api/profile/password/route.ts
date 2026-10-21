import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  /*
   * -------------------------------------------------------
   * AUTH
   * -------------------------------------------------------
   */
  const session =
    await getServerSession(authOptions);

  const email =
    session?.user?.email;

  if (!email) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * BODY
   * -------------------------------------------------------
   *
   * Current frontend:
   *
   * {
   *   currentPassword: "...",
   *   newPassword: "..."
   * }
   *
   * We also accept the older:
   *
   * {
   *   current: "...",
   *   next: "..."
   * }
   *
   * so older deployed frontend versions do not produce
   * invalid_payload.
   */
  let rawBody: any;

  try {
    rawBody =
      await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_json",
      },
      {
        status: 400,
      }
    );
  }

  const currentPassword =
    typeof rawBody?.currentPassword ===
    "string"
      ? rawBody.currentPassword
      : typeof rawBody?.current ===
          "string"
        ? rawBody.current
        : "";

  const newPassword =
    typeof rawBody?.newPassword ===
    "string"
      ? rawBody.newPassword
      : typeof rawBody?.next ===
          "string"
        ? rawBody.next
        : "";

  if (
    currentPassword.length === 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "current_password_required",
        detail:
          "Συμπληρώστε τον τρέχοντα κωδικό.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    newPassword.length < 6
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "new_password_too_short",
        detail:
          "Ο νέος κωδικός πρέπει να είναι τουλάχιστον 6 χαρακτήρες.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * USER
   * -------------------------------------------------------
   */
  const user =
    await prisma.user.findUnique({
      where: {
        email,
      },

      select: {
        id: true,
        passwordHash: true,
      },
    });

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_found",
      },
      {
        status: 404,
      }
    );
  }

  if (!user.passwordHash) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "password_not_configured",
        detail:
          "Δεν υπάρχει αποθηκευμένος κωδικός για αυτόν τον λογαριασμό.",
      },
      {
        status: 409,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * VERIFY CURRENT PASSWORD
   * -------------------------------------------------------
   */
  const correctPassword =
    await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

  if (!correctPassword) {
    return NextResponse.json(
      {
        ok: false,
        error: "wrong_password",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Prevent replacing the password
   * with exactly the same password.
   */
  const samePassword =
    await bcrypt.compare(
      newPassword,
      user.passwordHash
    );

  if (samePassword) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "same_password",
        detail:
          "Ο νέος κωδικός πρέπει να είναι διαφορετικός από τον τρέχοντα.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * SAVE NEW PASSWORD
   * -------------------------------------------------------
   */
  const passwordHash =
    await bcrypt.hash(
      newPassword,
      10
    );

  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      passwordHash,
    },
  });

  return NextResponse.json({
    ok: true,
  });
}