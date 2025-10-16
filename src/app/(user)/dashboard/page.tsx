"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCard from "@/components/DashboardCard";
import TrendMini from "@/components/TrendMini";

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
        <DashboardCard title="Files assigned to me" value={stats?.myAssigned ?? "—"} subtitle="Total assignments" />
        <DashboardCard title="My uploads" value={stats?.myFiles ?? "—"} subtitle="Files I uploaded" />
        <DashboardCard title="Trend (30 days)">
          <TrendMini data={assignedSeries} />
        </DashboardCard>
        <DashboardCard title="Shortcuts" subtitle="Common actions">
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/files" className="rounded border px-3 py-1 text-sm">My files</a>
            <a href="/support" className="rounded border px-3 py-1 text-sm">Support</a>
          </div>
        </DashboardCard>
      </div>

      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Recent assigned files</h2>
          <a href="/files" className="text-sm underline">View all</a>
        </div>
        {assigned.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No files yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Assigned</th>
                <th className="py-2 pr-3">Actions</th>
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
                        Download
                      </a>
                    ) : (
                      <span className="text-[color:var(--muted)]">No URL</span>
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
