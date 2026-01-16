// src/app/api/admin/users/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, context: { params: Params }) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const { id } = await context.params; // 👈 await params

  const UpdateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  subscriptionActive: z.boolean().optional(),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]).optional(), // 👈 NEW
});

  const body = await req.json();
  const data = UpdateSchema.parse(body);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, subscriptionActive: true, createdAt: true },
  });

  return NextResponse.json({ user });
}


export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const userId = ctx.params.id;
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const { id } = await context.params; // 👈 await params
  await prisma.user.delete({ where: { id } });

  try {
    // TODO: ensure admin auth here (your existing logic)

    await prisma.$transaction(async (tx) => {
      // 1) Delete profile (1-1)
      await tx.userProfile.deleteMany({ where: { userId } });

      // 2) Delete password reset tokens (if you have them)
      await tx.passwordResetToken.deleteMany({ where: { userId } });

      // 3) Delete file assignments (if exists)
      await tx.fileAssignment.deleteMany({
        where: { OR: [{ userId }, { assignedById: userId }] },
      });

      // 4) If files reference uploadedById -> make them null (so you don't lose files)
      await tx.file.updateMany({
        where: { uploadedById: userId },
        data: { uploadedById: null },
      });

      // 5) Finally delete user
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "delete_failed", detail: e?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
