import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SelectionSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    userIds: z.array(z.string().trim().min(1)).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => value.all === true || (value.userIds?.length ?? 0) > 0);

const RenameSchema = z.object({
  oldName: z.string().trim().min(1).max(80),
  newName: z.string().trim().min(1).max(80),
});

async function requireAdmin() {
  const guard = await requireRole("ADMIN");
  if (!guard.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: guard.status }
      ),
    };
  }
  return { ok: true as const };
}

async function activeUserIds() {
  const users = await prisma.user.findMany({
    where: { role: "USER", status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

function uniqueIds(ids?: string[]) {
  return Array.from(new Set((ids || []).map((id) => id.trim()).filter(Boolean)));
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const [folders, users] = await Promise.all([
    prisma.pdfFolder.findMany({
      where: { ownerId: { not: null } },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, ownerId: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { role: "USER", status: "ACTIVE" },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, email: true, name: true, role: true, status: true },
    }),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const grouped = new Map<string, any>();

  for (const folder of folders) {
    if (!folder.ownerId) continue;
    const owner = userById.get(folder.ownerId);
    if (!owner) continue;

    const group = grouped.get(folder.name) || {
      name: folder.name,
      folderIds: [],
      users: [],
      createdAt: folder.createdAt,
    };

    group.folderIds.push(folder.id);
    group.users.push({
      id: owner.id,
      email: owner.email,
      name: owner.name,
      folderId: folder.id,
    });

    if (folder.createdAt < group.createdAt) group.createdAt = folder.createdAt;
    grouped.set(folder.name, group);
  }

  const folderGroups = Array.from(grouped.values())
    .map((group: any) => ({
      ...group,
      count: group.users.length,
      users: group.users.sort((a: any, b: any) =>
        (a.name || a.email).localeCompare(b.name || b.email, "el")
      ),
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name, "el"));

  return NextResponse.json({ ok: true, folders: folderGroups, users });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = SelectionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const { name } = parsed.data;
  const requestedIds = parsed.data.all ? await activeUserIds() : uniqueIds(parsed.data.userIds);

  const validUsers = await prisma.user.findMany({
    where: { id: { in: requestedIds }, role: "USER", status: "ACTIVE" },
    select: { id: true },
  });
  const validIds = validUsers.map((user) => user.id);

  const existing = await prisma.pdfFolder.findMany({
    where: { name, ownerId: { in: validIds } },
    select: { ownerId: true },
  });
  const existingIds = new Set(existing.map((folder) => folder.ownerId).filter(Boolean));
  const missingIds = validIds.filter((id) => !existingIds.has(id));

  if (missingIds.length) {
    await prisma.pdfFolder.createMany({
      data: missingIds.map((ownerId) => ({ name, ownerId })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      created: missingIds.length,
      skipped: validIds.length - missingIds.length,
    },
    { status: 201 }
  );
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = RenameSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const { oldName, newName } = parsed.data;
  if (oldName === newName) return NextResponse.json({ ok: true, renamed: 0, merged: 0 });

  const result = await prisma.$transaction(async (tx) => {
    const oldFolders = await tx.pdfFolder.findMany({
      where: { name: oldName, ownerId: { not: null } },
      select: { id: true, ownerId: true },
    });

    if (!oldFolders.length) return { notFound: true, renamed: 0, merged: 0 };

    const ownerIds = oldFolders.map((folder) => folder.ownerId).filter(Boolean) as string[];
    const targets = await tx.pdfFolder.findMany({
      where: { name: newName, ownerId: { in: ownerIds } },
      select: { id: true, ownerId: true },
    });
    const targetByOwner = new Map(
      targets.filter((folder) => folder.ownerId).map((folder) => [folder.ownerId as string, folder.id])
    );

    let renamed = 0;
    let merged = 0;

    for (const folder of oldFolders) {
      if (!folder.ownerId) continue;
      const targetId = targetByOwner.get(folder.ownerId);

      if (targetId) {
        await tx.file.updateMany({
          where: { pdfFolderId: folder.id },
          data: { pdfFolderId: targetId },
        });
        await tx.pdfFolder.delete({ where: { id: folder.id } });
        merged += 1;
      } else {
        await tx.pdfFolder.update({ where: { id: folder.id }, data: { name: newName } });
        renamed += 1;
      }
    }

    return { notFound: false, renamed, merged };
  });

  if (result.notFound) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, renamed: result.renamed, merged: result.merged });
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = SelectionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const userIds = parsed.data.all ? await activeUserIds() : uniqueIds(parsed.data.userIds);

  const result = await prisma.$transaction(async (tx) => {
    const folders = await tx.pdfFolder.findMany({
      where: { name: parsed.data.name, ownerId: { in: userIds } },
      select: { id: true },
    });
    const ids = folders.map((folder) => folder.id);

    if (!ids.length) return { deletedFolders: 0, detachedFiles: 0 };

    const detached = await tx.file.updateMany({
      where: { pdfFolderId: { in: ids } },
      data: { pdfFolderId: null },
    });
    const deleted = await tx.pdfFolder.deleteMany({ where: { id: { in: ids } } });

    return { deletedFolders: deleted.count, detachedFiles: detached.count };
  });

  return NextResponse.json({ ok: true, ...result });
}
