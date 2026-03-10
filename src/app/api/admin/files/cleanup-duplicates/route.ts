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

function normalizeText(input: string) {
  return transliterateGreek(String(input || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeExactFileKey(name: string) {
  return normalizeText(name);
}

type FileRow = {
  id: string;
  title: string;
  originalName: string | null;
  createdAt: Date;
  assignments: { userId: string }[];
};

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const files: FileRow[] = await prisma.file.findMany({
      orderBy: { createdAt: "desc" }, // newest first
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

    // group key = assigned user + exact normalized filename/title
    const groups = new Map<string, FileRow[]>();

    for (const file of files) {
      const source = file.originalName || file.title || "";
      const exactKey = normalizeExactFileKey(source);
      if (!exactKey) continue;

      const assignedUserIds =
        file.assignments.length > 0
          ? [...new Set(file.assignments.map((a) => a.userId))].sort()
          : ["__unassigned__"];

      for (const userId of assignedUserIds) {
        const groupKey = `${userId}::${exactKey}`;
        const arr = groups.get(groupKey) || [];
        arr.push(file);
        groups.set(groupKey, arr);
      }
    }

    let groupsFound = 0;
    let deletedFiles = 0;
    const alreadyDeleted = new Set<string>();

    for (const [, arr] of groups.entries()) {
      if (arr.length <= 1) continue;

      groupsFound += 1;

      // newest first already from query, but sort again for safety
      const sorted = [...arr].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // keep newest, delete the rest
      const toDelete = sorted.slice(1);

      for (const file of toDelete) {
        if (alreadyDeleted.has(file.id)) continue;

        await prisma.$transaction(async (tx) => {
          const exists = await tx.file.findUnique({
            where: { id: file.id },
            select: { id: true },
          });

          if (!exists) return;

          await tx.fileAssignment.deleteMany({
            where: { fileId: file.id },
          });

          await tx.file.delete({
            where: { id: file.id },
          });
        });

        alreadyDeleted.add(file.id);
        deletedFiles += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      groupsFound,
      deletedFiles,
      totalFilesChecked: files.length,
    });
  } catch (err: any) {
    console.error("cleanup-duplicates failed:", err);

    return NextResponse.json(
      {
        error: "cleanup_failed",
        detail: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}