import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";
import bcrypt from "bcrypt";


const prisma = new PrismaClient();

async function requireAdmin() {
  const session = await getServerSession(authOptions as any);
  const role = (session?.user as any)?.role;
  if (!session?.user || role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: guard.status });
  return NextResponse.json({ users: [] });
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, subscriptionActive: true, createdAt: true },
  });
  return NextResponse.json(users);
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(60).optional(),
  password: z
    .string()
    .min(8, "Min 8 chars")
    .max(72, "Too long")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Need upper, lower, and a number"),
  subscriptionActive: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email, name, password, subscriptionActive = false } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, role: "USER", subscriptionActive },
  });

  await prisma.auditLog.create({
    data: { action: "USER_CREATED", actorId: (session.user as any).id, targetId: user.id, target: "User" },
  });

  return NextResponse.json({ id: user.id });
}
