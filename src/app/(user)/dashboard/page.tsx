// src/app/(user)/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TrendMini from "@/components/TrendMini";

type StatsUser = {
  assignedTotal: number;
  myUploadsTotal: number; // kept in API but not rendered as a table anymore
  series: { x: string; y: number }[];
};

type FileRow = { id: string; title: string; originalName: string; createdAt: string; url: string };

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
      {/* Top cards — 1/3 + 2/3 on large screens (no empty columns) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Assigned count */}
        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4">
          <div className="text-sm text-[color:var(--muted)] mb-3">Αρχεία που μου έχουν ανατεθεί</div>
          <div className="h-1 w-10 rounded bg-[color:var(--primary,#25C3F4)] mb-3" />
          <div className="text-sm">Σύνολο αναθέσεων</div>
          <div className="mt-2 text-2xl font-semibold">
            {stats ? stats.assignedTotal.toLocaleString() : "—"}
          </div>
        </div>

        {/* Trend card (spans 2 columns on lg) */}
        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-[color:var(--muted)]">Τάση (30 ημέρες)</span>
            <span className="text-xs text-[color:var(--muted)]">{totalUploads30d} σύνολο</span>
          </div>
          <TrendMini data={stats?.series || []} />
        </div>
      </div>

      {/* Recent assigned files (kept) */}
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="font-semibold">Πρόσφατα ανατεθειμένα αρχεία</h2>
          <Link href="/files" className="text-sm underline">Προβολή όλων</Link>
        </div>

        <div className="px-4 pb-4 overflow-x-auto">
          {!assigned.length ? (
            <p className="text-sm text-[color:var(--muted)]">Δεν υπάρχουν αρχεία ακόμη.</p>
          ) : (
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                  <th className="py-2 pr-3">Τίτλος</th>
                  <th className="py-2 pr-3">Ανέβηκε</th>
                  <th className="py-2 pr-3">Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {assigned.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 border-[color:var(--border)]">
                    <td className="py-2 pr-3">
                      {f.title} · <span className="text-[color:var(--muted)]">{f.originalName}</span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(f.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">
                      <a
                        href={f.url}
                        className="inline-flex rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
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
