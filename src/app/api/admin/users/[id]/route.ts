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

export async function DELETE(_req: Request, context: { params: Params }) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const { id } = await context.params; // 👈 await params
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
