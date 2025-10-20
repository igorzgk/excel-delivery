// src/app/(admin)/admin/support/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = {
  page?: string;
  q?: string;
  priority?: "" | "low" | "normal" | "high";
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

function linkWith(sp: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.priority) params.set("priority", sp.priority);
  if (sp.sort) params.set("sort", sp.sort);
  if (sp.page) params.set("page", sp.page);
  return `/admin/support?${params.toString()}`;
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

  let total = 0;
  let rows: { id: string; createdAt: Date; meta: unknown }[] = [];
  try {
    [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: sort },
        take,
        skip,
        select: { id: true, createdAt: true, meta: true },
      }),
    ]);
  } catch {
    total = 0;
    rows = [];
  }

  const pages = Math.max(1, Math.ceil(total / take));
  const q = searchParams.q ?? "";
  const priority = (searchParams.priority ?? "") as "" | "low" | "normal" | "high";
  const sortVal = searchParams.sort === "oldest" ? "oldest" : "newest";

  return (
    <main className="grid gap-4">
      <h1 className="text-2xl font-semibold">Αιτήματα Υποστήριξης</h1>
      <div className="text-sm text-muted-foreground">{total} σύνολο</div>

      {/* Toolbar */}
      <form
        action={linkWith({ q, priority, sort: sortVal, page: "1" })}
        className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Αναζήτηση θέμα, μήνυμα ή χρήστη…"
          className="rounded-xl border px-3 py-2 text-sm"
        />

        <select
          name="priority"
          defaultValue={priority}
          className="rounded-xl border px-3 py-2 text-sm sm:w-56"
        >
          <option value="">Όλες οι προτεραιότητες</option>
          <option value="high">Υψηλή</option>
          <option value="normal">Κανονική</option>
          <option value="low">Χαμηλή</option>
        </select>

        <select
          name="sort"
          defaultValue={sortVal}
          className="rounded-xl border px-3 py-2 text-sm sm:w-48"
        >
          <option value="newest">Νεότερα πρώτα</option>
          <option value="oldest">Παλαιότερα πρώτα</option>
        </select>

        {/* Brand-colored button (no black pill) */}
        <button
          type="submit"
          className="rounded-xl px-4 py-2 text-sm font-semibold text-black sm:justify-self-end"
          style={{ backgroundColor: "var(--brand, #25C3F4)" }}
        >
          Εφαρμογή
        </button>
      </form>

      {/* Mobile: 2-row cards */}
      <section className="grid gap-3 sm:hidden">
        {rows.map((r) => {
          const meta: any = (r as any).meta ?? {};
          const subject = String(meta.subject ?? "");
          const message = String(meta.message ?? "");
          const preview = message.length > 120 ? message.slice(0, 120) + "…" : message;
          const pri = String(meta.priority ?? "normal") as "low" | "normal" | "high";
          const userEmail = String(meta.userEmail ?? "");
          const userName = String(meta.userName ?? "");
          const dt = new Date(r.createdAt);

          return (
            <div key={r.id} className="rounded-2xl border bg-card p-3 shadow-sm">
              {/* Row 1: date/time left, priority badge right */}
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs text-slate-600 leading-5">
                  {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                </div>
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    pri === "high"
                      ? "bg-amber-100 text-amber-800"
                      : pri === "low"
                      ? "bg-slate-100 text-slate-700"
                      : "bg-slate-100 text-slate-700",
                  ].join(" ")}
                >
                  {pri === "high" ? "Υψηλή" : pri === "low" ? "Χαμηλή" : "Κανονική"}
                </span>
              </div>

              {/* Row 2: subject, from, preview */}
              <div className="mt-2 space-y-1">
                <div className="font-medium break-words">{subject || <span className="text-slate-400">—</span>}</div>
                <div className="text-xs text-slate-700 break-words">
                  {userName || "Άγνωστο"}{userEmail ? ` · ${userEmail}` : ""}
                </div>
                <div className="text-sm text-slate-600 break-words">{preview || "—"}</div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="text-sm text-muted-foreground">Δεν βρέθηκαν αιτήματα.</div>
        )}
      </section>

      {/* Desktop / Tablet: table with stable widths */}
      <section className="hidden sm:block rounded-2xl border bg-card p-4">
        <div className="overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[18%]" /> {/* Ημερ./Ώρα */}
              <col />                     {/* Θέμα */}
              <col className="w-[24%]" /> {/* Από */}
              <col className="w-[12%]" /> {/* Προτεραιότητα */}
              <col className="w-[28%]" /> {/* Προεπισκόπηση */}
            </colgroup>
            <thead className="bg-gray-50 text-gray-700">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Ημερ./Ώρα</th>
                <th className="px-4 py-3 font-semibold">Θέμα</th>
                <th className="px-4 py-3 font-semibold">Από</th>
                <th className="px-4 py-3 font-semibold">Προτεραιότητα</th>
                <th className="px-4 py-3 font-semibold">Προεπισκόπηση</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const meta: any = (r as any).meta ?? {};
                const subject = String(meta.subject ?? "");
                const message = String(meta.message ?? "");
                const preview = message.length > 120 ? message.slice(0, 120) + "…" : message;
                const pri = String(meta.priority ?? "normal");
                const userEmail = String(meta.userEmail ?? "");
                const userName = String(meta.userName ?? "");
                const created = new Date(r.createdAt).toLocaleString();

                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{created}</td>
                    <td className="px-4 py-3 break-words">
                      <div className="font-medium">{subject || <span className="text-gray-400">—</span>}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{userName || "Άγνωστο"}</span>
                        <span className="text-gray-500">{userEmail}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                          pri === "high"
                            ? "bg-amber-100 text-amber-800"
                            : pri === "low"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-slate-100 text-slate-700",
                        ].join(" ")}
                      >
                        {pri === "high" ? "Υψηλή" : pri === "low" ? "Χαμηλή" : "Κανονική"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 break-words">{preview || "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    Δεν βρέθηκαν αιτήματα.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Σελίδα {page} από {pages}</div>
          <div className="flex items-center gap-2">
            <Link
              aria-disabled={page <= 1}
              className={`rounded-xl border px-3 py-1.5 text-sm ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
              href={linkWith({ q, priority, sort: sortVal, page: String(page - 1) })}
            >
              Προηγούμενη
            </Link>
            <Link
              aria-disabled={page >= pages}
              className={`rounded-xl border px-3 py-1.5 text-sm ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
              href={linkWith({ q, priority, sort: sortVal, page: String(page + 1) })}
            >
              Επόμενη
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
