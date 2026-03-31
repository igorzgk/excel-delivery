// src/app/api/admin/files/delete-all-excel-storage/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY!;
const BUCKET = process.env.SUPABASE_BUCKET || "Files";

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

type StorageNode = {
  name: string;
  id?: string | null;
};

function isExcelFile(name: string) {
  const n = (name || "").toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xls");
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function listAllExcelPathsRecursively(
  supabase: ReturnType<typeof supabaseAdmin>,
  prefix = ""
): Promise<string[]> {
  const found: string[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`List failed at "${prefix}": ${error.message}`);
    }

    const items = (data || []) as StorageNode[];
    if (!items.length) break;

    for (const item of items) {
      const childPath = prefix ? `${prefix}/${item.name}` : item.name;

      // folder
      if (!item.id) {
        const nested = await listAllExcelPathsRecursively(supabase, childPath);
        found.push(...nested);
        continue;
      }

      // file
      if (isExcelFile(item.name)) {
        found.push(childPath);
      }
    }

    if (items.length < limit) break;
    offset += limit;
  }

  return found;
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const supabase = supabaseAdmin();

    // 1) Find all excel files in storage
    const excelPaths = await listAllExcelPathsRecursively(supabase, "");

    // 2) Delete excel files from storage
    let storageDeleted = 0;
    const storageFailed: Array<{ paths: string[]; error: string }> = [];

    for (const batch of chunk(excelPaths, 100)) {
      const { error } = await supabase.storage.from(BUCKET).remove(batch);

      if (error) {
        storageFailed.push({
          paths: batch,
          error: error.message,
        });
      } else {
        storageDeleted += batch.length;
      }
    }

    // 3) Delete related DB assignments first
    const assignmentDeleteResult = await prisma.fileAssignment.deleteMany({
      where: {
        file: {
          OR: [
            { mime: { contains: "excel", mode: "insensitive" } },
            { mime: { contains: "spreadsheet", mode: "insensitive" } },
            { originalName: { endsWith: ".xlsx", mode: "insensitive" } },
            { originalName: { endsWith: ".xls", mode: "insensitive" } },
            { title: { endsWith: ".xlsx", mode: "insensitive" } },
            { title: { endsWith: ".xls", mode: "insensitive" } },
          ],
        },
      },
    });

    // 4) Delete DB file rows
    const fileDeleteResult = await prisma.file.deleteMany({
      where: {
        OR: [
          { mime: { contains: "excel", mode: "insensitive" } },
          { mime: { contains: "spreadsheet", mode: "insensitive" } },
          { originalName: { endsWith: ".xlsx", mode: "insensitive" } },
          { originalName: { endsWith: ".xls", mode: "insensitive" } },
          { title: { endsWith: ".xlsx", mode: "insensitive" } },
          { title: { endsWith: ".xls", mode: "insensitive" } },
        ],
      },
    });

    return NextResponse.json({
      ok: true,
      bucket: BUCKET,
      storageFound: excelPaths.length,
      storageDeleted,
      storageFailedCount: storageFailed.length,
      storageFailed,
      dbAssignmentsDeleted: assignmentDeleteResult.count,
      dbFilesDeleted: fileDeleteResult.count,
      deletedPaths: excelPaths,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "delete_all_excel_storage_failed",
        detail: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}