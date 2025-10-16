"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardCard from "@/components/DashboardCard";
import TrendMini from "@/components/TrendMini";

type Stats = { users:number; pending:number; files:number };
type FileRow = { id:string; createdAt:string };
type AuditRow = {
  id:string; createdAt:string; action:string;
  target?:string|null; targetId?:string|null;
  actor?:{ email:string; name?:string|null }|null;
  meta?:any;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/stats", { cache: "no-store" });
      if (s.ok) setStats(await s.json());
      const a = await fetch("/api/admin/audit?limit=10", { cache: "no-store" });
      if (a.ok) setAudit((await a.json()).items);
      const f = await fetch("/api/files?scope=all", { cache: "no-store" });
      if (f.ok) {
        const json = await f.json();
        setFiles(json.files.map((x:any)=>({ id:x.id, createdAt:x.createdAt })));
      }
    })();
  }, []);

  // Make a 30-day series from file createdAt timestamps
  const uploadsSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    const fmt = (d:Date)=> d.toISOString().slice(0,10);
    const today = new Date();
    for (let i=29;i>=0;i--){
      const d = new Date(today); d.setDate(today.getDate()-i);
      byDay.set(fmt(d), 0);
    }
    for (const f of files) {
      const k = fmt(new Date(f.createdAt));
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) || 0) + 1);
    }
    return Array.from(byDay.entries()).map(([k,v])=>({ x:k, y:v }));
  }, [files]);

  return (
    <div className="grid gap-4">
      {/* Top stats row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Users" value={stats?.users ?? "—"} subtitle="Total registered" />
        <DashboardCard title="Pending approvals" value={stats?.pending ?? "—"} subtitle="Awaiting activation" />
        <DashboardCard title="Files" value={stats?.files ?? "—"} subtitle="Total uploaded" />
        <DashboardCard title="Quick actions" subtitle="Common admin tasks">
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/admin/users" className="rounded border px-3 py-1 text-sm">Manage users</a>
            <a href="/admin/uploads" className="rounded border px-3 py-1 text-sm">Upload file</a>
            <a href="/admin/audit" className="rounded border px-3 py-1 text-sm">View logs</a>
          </div>
        </DashboardCard>
      </div>

      {/* Uploads trend + recent audit */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardCard title="Uploads — last 30 days" right={<span className="text-xs text-[color:var(--muted)]">{uploadsSeries.reduce((a,b)=>a+b.y,0)} total</span>}>
          <TrendMini data={uploadsSeries} />
        </DashboardCard>

        <section className="lg:col-span-2 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Recent activity</h2>
            <a href="/admin/audit" className="text-sm underline">View all</a>
          </div>
          {audit.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">No activity yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Meta</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(r => (
                  <tr key={r.id} className="border-b last:border-0 border-[color:var(--border)] align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3 font-medium">{r.action}</td>
                    <td className="py-2 pr-3">{r.actor ? (r.actor.email + (r.actor.name ? ` (${r.actor.name})` : "")) : "—"}</td>
                    <td className="py-2 pr-3">{r.target ?? "—"} {r.targetId ? <span className="text-[color:var(--muted)]">#{r.targetId}</span> : null}</td>
                    <td className="py-2 pr-3">
                      <pre className="max-w-[40ch] whitespace-pre-wrap break-words text-xs bg-black/5 rounded p-2">
                        {r.meta ? JSON.stringify(r.meta, null, 2) : "—"}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
