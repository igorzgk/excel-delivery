import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";

/* ---------------- PATCH ---------------- */
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const { id } = ctx.params;

  const UpdateSchema = z.object({
    name: z.string().min(2).optional(),
    role: z.enum(["USER", "ADMIN"]).optional(),
    subscriptionActive: z.boolean().optional(),
    status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]).optional(),
  });

  const body = await req.json();
  const data = UpdateSchema.parse(body);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      subscriptionActive: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } });
}

/* ---------------- DELETE ---------------- */
export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const userId = ctx.params.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1) Remove assignments referencing this user (assignee OR assigner)
      await tx.fileAssignment.deleteMany({
        where: { OR: [{ userId }, { assignedById: userId }] },
      });

      // 2) Keep files but detach uploader to avoid FK constraint
      await tx.file.updateMany({
        where: { uploadedById: userId },
        data: { uploadedById: null },
      });

      // 3) Delete profile
      await tx.userProfile.deleteMany({ where: { userId } });

      // 4) Delete reset tokens (if model exists)
      // If you are 100% sure it exists, you can remove the catch.
      await tx.passwordResetToken
        .deleteMany({ where: { userId } })
        .catch(() => {});

      // 5) Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "delete_failed", detail: e?.message || "Delete failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
