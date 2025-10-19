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

type FileRow = { id: string; title: string; originalName: string; createdAt: string; url: string };

export default function UserDashboard() {
  const [stats, setStats] = useState<StatsUser | null>(null);
  const [assigned, setAssigned] = useState<FileRow[]>([]);

  useEffect(() => {
    (async () => {
      // user stats
      try {
        const r = await fetch("/api/stats-user", { cache: "no-store" });
        if (r.ok) setStats(await r.json());
      } catch {}

      // files visible to me (your /api/files already returns uploads + assignments for user scope)
      try {
        const f = await fetch("/api/files", { cache: "no-store" });
        if (f.ok) {
          const json = await f.json();
          // Keep the ones assigned to me most recently for the small list below
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
      {/* Top cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4">
          <div className="text-sm text-[color:var(--muted)] mb-3">Αρχεία που μου έχουν ανατεθεί</div>
          <div className="h-1 w-10 rounded bg-[color:var(--primary,#25C3F4)] mb-3" />
          <div className="text-sm">Σύνολο αναθέσεων</div>
          <div className="mt-2 text-2xl font-semibold">{stats ? stats.assignedTotal.toLocaleString() : "—"}</div>
        </div>

        <div className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4 lg:col-span-2">
          <div className="text-sm text-[color:var(--muted)] mb-2">Τάση (30 ημέρες)</div>
          <TrendMini data={stats?.series || []} />
          <div className="mt-2 text-xs text-[color:var(--muted)]">{totalUploads30d} σύνολο</div>
        </div>
      </div>

      {/* ONLY recent assigned files list (removed the separate "my uploads" table) */}
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
                    <td className="py-2 pr-3">{f.title} · <span className="text-[color:var(--muted)]">{f.originalName}</span></td>
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(f.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      <a href={f.url} className="inline-flex rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
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
