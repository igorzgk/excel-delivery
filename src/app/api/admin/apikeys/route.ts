import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import bcrypt from "bcrypt";

export async function GET() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, isActive: true, createdAt: true, lastUsedAt: true }
  });
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) return NextResponse.json({ error: "unauthorized" }, { status: guard.status });

  const { label } = await req.json().catch(() => ({ label: "Integration Key" }));
  const plain = cryptoRandom(48);
  const keyHash = await bcrypt.hash(plain, 10);

  const key = await prisma.apiKey.create({
    data: { label: label || "Integration Key", keyHash },
    select: { id: true, label: true, isActive: true, createdAt: true }
  });

  // IMPORTANT: return the plain key only once to admin UI
  return NextResponse.json({ key, plain }, { status: 201 });
}

function cryptoRandom(len = 48) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
