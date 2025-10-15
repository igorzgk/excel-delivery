import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";
import bcrypt from "bcrypt";

export async function GET(req: Request) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as "PENDING" | "ACTIVE" | "SUSPENDED" | null;

  const users = await prisma.user.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, subscriptionActive: true, status: true, createdAt: true },
  });

  return NextResponse.json({ users });
}


const CreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["USER", "ADMIN"]).default("USER"),
  subscriptionActive: z.boolean().default(false),
});

export async function POST(req: Request) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const body = await req.json();
  const data = CreateSchema.parse(body);

  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      subscriptionActive: data.subscriptionActive,
    },
    select: { id: true, name: true, email: true, role: true, subscriptionActive: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
