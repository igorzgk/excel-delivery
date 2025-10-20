// src/app/(user)/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TrendMini from "@/components/TrendMini";

type StatsUser = {
  assignedTotal: number;
  myUploadsTotal: number;
  series: { x: string; y: number }[];
};

type FileRow = {
  id: string;
  title: string;
  originalName: string;
  createdAt: string;
  url: string;
};

export default function UserDashboard() {
  const [stats, setStats] = useState<StatsUser | null>(null);
  const [assigned, setAssigned] = useState<FileRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/stats-user", { cache: "no-store" });
        if (r.ok) setStats(await r.json());
      } catch {}

      try {
        const f = await fetch("/api/files", { cache: "no-store" });
        if (f.ok) {
          const json = await f.json();
          const rows: FileRow[] = (json.files as any[]).map((x) => ({
            id: x.id,
            title: x.title,
            originalName: x.originalName,
            createdAt: x.createdAt,
            url: x.url,
          }));
          setAssigned(rows.slice(0, 10));
        }
      } catch {}
    })();
  }, []);

  const totalUploads30d = useMemo(
    () => (stats?.series || []).reduce((a, b) => a + b.y, 0),
    [stats]
  );

  return (
    <div className="grid gap-4">
      {/* === Top cards === */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Assigned count */}
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] shadow-sm p-4">
          <div className="text-sm text-[color:var(--muted)] mb-3">
            Αρχεία που μου έχουν ανατεθεί
          </div>
          <div className="h-1 w-10 rounded bg-[color:var(--primary,#25C3F4)] mb-3" />
          <div className="text-sm">Σύνολο αναθέσεων</div>
          <div className="mt-2 text-2xl font-semibold">
            {stats ? stats.assignedTotal.toLocaleString() : "—"}
          </div>
        </div>

        {/* Trend card */}
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] shadow-sm p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-[color:var(--muted)]">Τάση (30 ημέρες)</span>
            <span className="text-xs text-[color:var(--muted)]">
              {totalUploads30d} σύνολο
            </span>
          </div>
          <TrendMini data={stats?.series || []} />
        </div>
      </div>

      {/* === Recent assigned files === */}
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2">
          <h2 className="font-semibold">Πρόσφατα ανατεθειμένα αρχεία</h2>
          <Link href="/files" className="text-sm underline">
            Προβολή όλων
          </Link>
        </div>

        {/* --- Mobile (cards, 2 rows) --- */}
        <div className="px-4 pb-4 sm:hidden grid gap-3">
          {!assigned.length ? (
            <p className="text-sm text-[color:var(--muted)]">Δεν υπάρχουν αρχεία ακόμη.</p>
          ) : (
            assigned.map((f) => {
              const dt = new Date(f.createdAt);
              return (
                <div
                  key={f.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-white p-3 shadow-sm"
                >
                  {/* Row 1: Title + download */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium break-words">{f.title}</div>
                      <div className="text-xs text-gray-600">
                        {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                      </div>
                    </div>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-lg px-3 py-1 text-sm font-semibold text-black"
                      style={{ backgroundColor: "var(--brand,#25C3F4)" }}
                    >
                      Λήψη
                    </a>
                  </div>

                  {/* Row 2: Original filename */}
                  <div className="mt-2 text-sm text-gray-700 break-words">
                    {f.originalName || "—"}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* --- Desktop / Tablet table --- */}
        <div className="hidden sm:block px-4 pb-4 overflow-x-auto">
          {!assigned.length ? (
            <p className="text-sm text-[color:var(--muted)]">Δεν υπάρχουν αρχεία ακόμη.</p>
          ) : (
            <table className="min-w-[720px] w-full text-sm">
              <colgroup>
                <col className="w-[55%]" />
                <col className="w-[25%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                  <th className="py-2 pr-3">Τίτλος</th>
                  <th className="py-2 pr-3">Ανέβηκε</th>
                  <th className="py-2 pr-3 text-right">Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {assigned.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b last:border-0 border-[color:var(--border)] align-top"
                  >
                    <td className="py-2 pr-3">
                      <div className="font-medium">{f.title}</div>
                      <div className="text-xs text-[color:var(--muted)] break-words">
                        {f.originalName}
                      </div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(f.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-lg px-3 py-1 text-xs font-semibold text-black"
                        style={{ backgroundColor: "var(--brand,#25C3F4)" }}
                      >
                        Λήψη
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
