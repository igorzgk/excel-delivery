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

export default async function AdminSupportPage({ searchParams }: { searchParams: SearchParams }) {
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
    <main className="mx-auto max-w-6xl px-3 md:px-6 py-6 text-[inherit]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-[inherit]">Αιτήματα Υποστήριξης</h1>
          <p className="mt-1 text-sm text-gray-600">{total.toLocaleString()} σύνολο</p>
        </div>

        <form className="flex flex-wrap items-center gap-2" action="/admin/support" method="get">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Αναζήτηση θέμα, μήνυμα ή χρήστη…"
            className="w-full sm:w-64 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring text-[inherit] bg-white/90"
          />
          <select
            name="priority"
            defaultValue={priority}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white/90 text-[inherit]"
          >
            <option value="">Όλες οι προτεραιότητες</option>
            <option value="normal">Κανονική</option>
            <option value="high">Υψηλή</option>
            <option value="urgent">Επείγον</option>
          </select>
          <select
            name="sort"
            defaultValue={searchParams.sort === "oldest" ? "oldest" : "newest"}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white/90 text-[inherit]"
          >
            <option value="newest">Νεότερα πρώτα</option>
            <option value="oldest">Παλαιότερα πρώτα</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Εφαρμογή
          </button>
        </form>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
        <table className="w-full table-fixed text-sm text-[inherit]">
          <thead className="bg-gray-50 text-gray-700">
            <tr className="text-left font-semibold">
              <th className="px-3 md:px-4 py-3 w-[20%]">Ημερ./Ώρα</th>
              <th className="px-3 md:px-4 py-3 w-[35%]">Θέμα</th>
              <th className="px-3 md:px-4 py-3 hidden md:table-cell w-[20%]">Από</th>
              <th className="px-3 md:px-4 py-3 w-[15%]">Προτεραιότητα</th>
              <th className="px-3 md:px-4 py-3 hidden md:table-cell w-[25%]">Προεπισκόπηση</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((r) => {
              const meta: any = r.meta ?? {};
              const subject = String(meta.subject ?? "");
              const message = String(meta.message ?? "");
              const preview = message.length > 120 ? message.slice(0, 120) + "…" : message;
              const pri = String(meta.priority ?? "normal");
              const userEmail = String(meta.userEmail ?? "");
              const userName = String(meta.userName ?? "");
              const created = new Date(r.createdAt).toLocaleString();

              return (
                <tr key={r.id} className="align-top">
                  <td className="px-3 md:px-4 py-3 text-xs md:text-sm text-gray-600 whitespace-nowrap">{created}</td>

                  <td className="px-3 md:px-4 py-3 whitespace-normal break-words">
                    <div className="font-medium text-[inherit]">{subject || <span className="text-gray-400">—</span>}</div>
                    {/* Mobile sender under subject */}
                    <div className="mt-1 text-xs text-gray-500 md:hidden">
                      {userName || "Άγνωστο"}{userEmail ? ` · ${userEmail}` : ""}
                    </div>
                    {/* Mobile short preview */}
                    <div className="mt-1 text-xs text-gray-600 md:hidden">{preview || "—"}</div>
                  </td>

                  <td className="px-3 md:px-4 py-3 hidden md:table-cell text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-[inherit]">{userName || "Άγνωστο"}</span>
                      <span className="text-gray-500">{userEmail}</span>
                    </div>
                  </td>

                  <td className="px-3 md:px-4 py-3">
                    <span
                      className={[
                        "nowrap inline-flex rounded-full px-2 py-1 text-xs font-medium",
                        pri === "urgent"
                          ? "bg-red-100 text-red-700"
                          : pri === "high"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-700",
                      ].join(" ")}
                    >
                      {pri === "urgent" ? "Επείγον" : pri === "high" ? "Υψηλή" : "Κανονική"}
                    </span>
                  </td>

                  <td className="px-3 md:px-4 py-3 hidden md:table-cell text-gray-600 whitespace-normal break-words">
                    {preview || "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={5}>
                  Δεν βρέθηκαν αιτήματα.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Σελιδοποίηση */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">Σελίδα {page} από {pages}</div>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={page <= 1}
            className={`rounded-xl border px-3 py-1.5 text-sm ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
            href={linkWith({ page: String(page - 1) })}
          >
            Προηγούμενη
          </Link>
          <Link
            aria-disabled={page >= pages}
            className={`rounded-xl border px-3 py-1.5 text-sm ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
            href={linkWith({ page: String(page + 1) })}
          >
            Επόμενη
          </Link>
        </div>
      </div>
    </main>
  );
}
