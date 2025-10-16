// src/app/(user)/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCard from "@/components/DashboardCard";
import TrendMini from "@/components/TrendMini";
import Link from "next/link";

type Stats = { myFiles:number; myAssigned:number };
type FileRow = { id:string; title:string; originalName?:string|null; url?:string|null; createdAt:string };

export default function UserDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [assigned, setAssigned] = useState<FileRow[]>([]);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/stats", { cache: "no-store" });
      if (s.ok) setStats(await s.json());
      const a = await fetch("/api/files?scope=assigned", { cache: "no-store" });
      if (a.ok) setAssigned((await a.json()).files);
    })();
  }, []);

  const assignedSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    const fmt = (d:Date)=> d.toISOString().slice(0,10);
    const today = new Date();
    for (let i=29;i>=0;i--){
      const d = new Date(today); d.setDate(today.getDate()-i);
      byDay.set(fmt(d), 0);
    }
    for (const f of assigned) {
      const k = fmt(new Date(f.createdAt));
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) || 0) + 1);
    }
    return Array.from(byDay.entries()).map(([k,v])=>({ x:k, y:v }));
  }, [assigned]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Αρχεία που μου έχουν ανατεθεί" value={stats?.myAssigned ?? "—"} subtitle="Σύνολο αναθέσεων" />
        <DashboardCard title="Τα δικά μου ανεβάσματα" value={stats?.myFiles ?? "—"} subtitle="Αρχεία που ανέβασα" />
        <DashboardCard title="Τάση (30 ημέρες)">
          <TrendMini data={assignedSeries} />
        </DashboardCard>
        <DashboardCard title="Συντομεύσεις" subtitle="Συνηθισμένες ενέργειες">
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/files" className="rounded border px-3 py-1 text-sm">Τα αρχεία μου</Link>
            <Link href="/support" className="rounded border px-3 py-1 text-sm">Υποστήριξη</Link>
          </div>
        </DashboardCard>
      </div>

      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Πρόσφατα ανατεθειμένα αρχεία</h2>
          <Link href="/files" className="text-sm underline">Προβολή όλων</Link>
        </div>
        {assigned.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">Δεν υπάρχουν αρχεία ακόμη.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                <th className="py-2 pr-3">Τίτλος</th>
                <th className="py-2 pr-3">Ανάθεση</th>
                <th className="py-2 pr-3">Ενέργειες</th>
              </tr>
            </thead>
            <tbody>
              {assigned.slice(0,6).map(f => (
                <tr key={f.id} className="border-b last:border-0 border-[color:var(--border)]">
                  <td className="py-2 pr-3">
                    {f.title}
                    {f.originalName ? <span className="text-[color:var(--muted)]"> · {f.originalName}</span> : null}
                  </td>
                  <td className="py-2 pr-3">{new Date(f.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    {f.url ? (
                      <a href={f.url} target="_blank" rel="noreferrer" className="rounded border px-3 py-1 hover:bg-black/5">
                        Λήψη
                      </a>
                    ) : (
                      <span className="text-[color:var(--muted)]">Δεν υπάρχει URL</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
