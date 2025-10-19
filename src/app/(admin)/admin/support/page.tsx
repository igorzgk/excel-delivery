// src/app/(admin)/admin/support/page.tsx
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SearchParams = {
  page?: string;
  q?: string;
  priority?: "normal" | "high" | "urgent" | "";
  sort?: "newest" | "oldest";
};

const PAGE_SIZE = 20;

function toInt(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function buildWhere(sp: SearchParams) {
  const where: any = { action: "SUPPORT_TICKET" };
  if (sp.q) {
    const q = sp.q.trim();
    if (q) {
      where.OR = [
        { meta: { path: ["subject"], string_contains: q, mode: "insensitive" } },
        { meta: { path: ["message"], string_contains: q, mode: "insensitive" } },
        { meta: { path: ["userEmail"], string_contains: q, mode: "insensitive" } },
        { meta: { path: ["userName"], string_contains: q, mode: "insensitive" } },
      ];
    }
  }
  if (sp.priority) {
    where.AND = [
      ...(where.AND ?? []),
      { meta: { path: ["priority"], equals: sp.priority } },
    ];
  }
  return where;
}

export default async function AdminSupportPage({
  searchParams,
}: { searchParams: SearchParams }) {
  const me = await currentUser();
  if (!me) redirect("/login?next=/admin/support");
  if (me.role !== "ADMIN") redirect("/dashboard");

  const page = toInt(searchParams.page, 1);
  const take = PAGE_SIZE;
  const skip = (page - 1) * take;
  const sort = searchParams.sort === "oldest" ? "asc" : "desc";
  const where = buildWhere(searchParams);

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: sort },
      take,
      skip,
      select: { id: true, createdAt: true, meta: true },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / take));
  const q = searchParams.q ?? "";
  const priority = (searchParams.priority ?? "") as "" | "normal" | "high" | "urgent";

  const linkWith = (patch: Partial<SearchParams>) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (priority) sp.set("priority", priority);
    sp.set("sort", searchParams.sort === "oldest" ? "oldest" : "newest");
    sp.set("page", String(page));
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" || v == null) continue;
      sp.set(k, String(v));
    }
    return `/admin/support?${sp.toString()}`;
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Support Tickets</h1>
          <p className="mt-1 text-sm text-gray-600">{total} ticket{total === 1 ? "" : "s"} total</p>
        </div>

        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2" action="/admin/support" method="get">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search subject, message, user…"
              className="w-64 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring"
            />
            <select
              name="priority"
              defaultValue={priority}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All priorities</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              name="sort"
              defaultValue={searchParams.sort === "oldest" ? "oldest" : "newest"}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button
              type="submit"
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Apply
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm font-semibold text-gray-700">
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((r) => {
              const meta: any = r.meta ?? {};
              const subject = String(meta.subject ?? "");
              const message = String(meta.message ?? "");
              const preview = message.length > 120 ? message.slice(0, 120) + "…" : message;
              const priority = String(meta.priority ?? "normal");
              const userEmail = String(meta.userEmail ?? "");
              const userName = String(meta.userName ?? "");
              const created = new Date(r.createdAt).toLocaleString();

              return (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{created}</td>
                  <td className="px-4 py-3 text-sm">{subject || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">{userName || "Unknown"}</span>
                      <span className="text-gray-500">{userEmail}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                        priority === "urgent"
                          ? "bg-red-100 text-red-700"
                          : priority === "high"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-700",
                      ].join(" ")}
                    >
                      {priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{preview || "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={5}>
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">Page {page} of {pages}</div>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={page <= 1}
            className={`rounded-xl border px-3 py-1.5 text-sm ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
            href={linkWith({ page: String(page - 1) })}
          >
            Prev
          </Link>
          <Link
            aria-disabled={page >= pages}
            className={`rounded-xl border px-3 py-1.5 text-sm ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
            href={linkWith({ page: String(page + 1) })}
          >
            Next
          </Link>
        </div>
      </div>
    </main>
  );
}
