import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "Files";

function extractStorageKeyFromUrl(url?: string | null) {
  if (!url) return null;
  const m = url.match(/\/api\/files\/download\/(.+)$/);
  if (!m) return null;

  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

async function objectExists(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  keyPath: string
) {
  const parts = keyPath.split("/");
  const fileName = parts.pop();
  const folder = parts.join("/");

  if (!fileName) return false;

  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 1000,
    offset: 0,
    search: fileName,
  });

  if (error || !data) return false;

  return data.some((item) => item.name === fileName);
}

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const files = await prisma.file.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        originalName: true,
        url: true,
        createdAt: true,
        assignments: {
          select: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    const missing: Array<{
      id: string;
      title: string;
      originalName: string | null;
      url: string | null;
      storageKey: string | null;
      assignedTo: string[];
    }> = [];

    for (const file of files) {
      const storageKey = extractStorageKeyFromUrl(file.url);

      if (!storageKey) {
        missing.push({
          id: file.id,
          title: file.title,
          originalName: file.originalName,
          url: file.url ?? null,
          storageKey: null,
          assignedTo: file.assignments.map((a) => a.user.email),
        });
        continue;
      }

      const exists = await objectExists(supabase, BUCKET, storageKey);

      if (!exists) {
        missing.push({
          id: file.id,
          title: file.title,
          originalName: file.originalName,
          url: file.url ?? null,
          storageKey,
          assignedTo: file.assignments.map((a) => a.user.email),
        });
      }
    }

    let deletedFiles = 0;
    let deletedAssignments = 0;

    for (const file of missing) {
      const result = await prisma.$transaction(async (tx) => {
        const assignmentDelete = await tx.fileAssignment.deleteMany({
          where: { fileId: file.id },
        });

        await tx.file.delete({
          where: { id: file.id },
        });

        return {
          deletedAssignments: assignmentDelete.count,
        };
      });

      deletedFiles += 1;
      deletedAssignments += result.deletedAssignments;
    }

    return NextResponse.json({
      ok: true,
      bucket: BUCKET,
      missingFound: missing.length,
      deletedFiles,
      deletedAssignments,
      deleted: missing,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "cleanup_failed",
        detail: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}