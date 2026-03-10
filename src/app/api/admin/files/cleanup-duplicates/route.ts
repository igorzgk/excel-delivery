import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const runtime = "nodejs";

function transliterateGreek(input: string) {
  const map: Record<string, string> = {
    Α: "A", Β: "V", Γ: "G", Δ: "D", Ε: "E", Ζ: "Z", Η: "I", Θ: "TH",
    Ι: "I", Κ: "K", Λ: "L", Μ: "M", Ν: "N", Ξ: "X", Ο: "O", Π: "P",
    Ρ: "R", Σ: "S", Τ: "T", Υ: "Y", Φ: "F", Χ: "CH", Ψ: "PS", Ω: "O",
    α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th",
    ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
    ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
    Ά: "A", Έ: "E", Ή: "I", Ί: "I", Ό: "O", Ύ: "Y", Ώ: "O",
    ά: "a", έ: "e", ή: "i", ί: "i", ό: "o", ύ: "y", ώ: "o",
    Ϊ: "I", Ϋ: "Y", ϊ: "i", ϋ: "y", ΐ: "i", ΰ: "y",
  };

  return Array.from(input || "")
    .map((ch) => map[ch] ?? ch)
    .join("");
}

function normalizeFilenameForDedup(name: string) {
  const n = String(name || "").trim();
  if (!n) return "";

  const dot = n.lastIndexOf(".");
  const ext = dot > 0 ? n.slice(dot).toLowerCase() : "";
  let base = dot > 0 ? n.slice(0, dot) : n;

  base = transliterateGreek(base)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // remove trailing month-year like _3-2026 / -03_2026 / 3 2026
  base = base.replace(/([_\-\s])?(0?[1-9]|1[0-2])([_\-\s])\d{4}$/i, "");

  base = base
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${base}${ext}`;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const files = await prisma.file.findMany({
    orderBy: { createdAt: "asc" }, // oldest first
    select: {
      id: true,
      title: true,
      originalName: true,
      createdAt: true,
      assignments: {
        select: {
          userId: true,
        },
      },
    },
  });

  type GroupItem = {
    id: string;
    createdAt: Date;
  };

  const groups = new Map<string, GroupItem[]>();

  for (const file of files) {
    const nameSource = file.originalName || file.title || "";
    const normalized = normalizeFilenameForDedup(nameSource);
    if (!normalized) continue;

    const assignedUserIds =
      file.assignments?.length > 0
        ? file.assignments.map((a) => a.userId).sort()
        : ["__unassigned__"];

    for (const userId of assignedUserIds) {
      const key = `${userId}::${normalized}`;
      const arr = groups.get(key) || [];
      arr.push({
        id: file.id,
        createdAt: new Date(file.createdAt),
      });
      groups.set(key, arr);
    }
  }

  let groupsFound = 0;
  let deletedFiles = 0;

  for (const [, arr] of groups.entries()) {
    if (arr.length <= 1) continue;

    groupsFound += 1;

    // oldest first because query is asc, but sort anyway for safety
    arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // keep newest, delete all older
    const toDelete = arr.slice(0, -1);

    for (const row of toDelete) {
      await prisma.fileAssignment.deleteMany({
        where: { fileId: row.id },
      });

      await prisma.file.delete({
        where: { id: row.id },
      });

      deletedFiles += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    groupsFound,
    deletedFiles,
  });
}