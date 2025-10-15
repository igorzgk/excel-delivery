import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, ctx: { params: Params }) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const { id } = await ctx.params;
  const { isActive } = await req.json();
  const updated = await prisma.apiKey.update({ where: { id }, data: { isActive: !!isActive } });
  return NextResponse.json({ ok: true, key: { id: updated.id, isActive: updated.isActive } });
}

export async function DELETE(_req: Request, ctx: { params: Params }) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const { id } = await ctx.params;
  await prisma.apiKey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
