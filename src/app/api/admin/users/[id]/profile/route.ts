// src/app/api/admin/users/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type Params = {
  params: { id: string };
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
    return null;
  }
  return session;
}

/**
 * PATCH /api/admin/users/[id]
 * Used by the admin users table to change:
 * - role
 * - status
 * - subscriptionActive
 */
export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = params.id;
  const body = await req.json();

  const data: any = {};
  if (typeof body.role === "string") {
    data.role = body.role;
  }
  if (typeof body.status === "string") {
    data.status = body.status;
  }
  if (typeof body.subscriptionActive === "boolean") {
    data.subscriptionActive = body.subscriptionActive;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
    });
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete user AND related profile/records to avoid FK constraint errors.
 */
export async function DELETE(req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = params.id;

  try {
    await prisma.$transaction(async (tx) => {
      // 1) Delete profile (fixes UserProfile_userId_fkey)
      await tx.userProfile.deleteMany({ where: { userId: id } });

      // 2) Optionally clean related data (safe even if nothing exists)
      await tx.fileAssignment.deleteMany({ where: { userId: id } });
      await tx.fileAssignment.deleteMany({ where: { assignedById: id } });
      await tx.file.deleteMany({ where: { uploadedById: id } });
      await tx.auditLog.deleteMany({ where: { actorId: id } });

      // 3) Finally delete the user
      await tx.user.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
}
