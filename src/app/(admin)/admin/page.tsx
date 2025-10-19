// src/app/(admin)/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardCard from "@/components/DashboardCard";
import TrendMini from "@/components/TrendMini";

type Stats = { users: number; pending: number; files: number };
type FileRow = { id: string; createdAt: string };
type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  target?: string | null;
  targetId?: string | null;
  actor?: { email: string; name?: string | null } | null;
  meta?: any;
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
        setFiles(json.files.map((x: any) => ({ id: x.id, createdAt: x.createdAt })));
      }
    })();
  }, []);

  const uploadsSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      byDay.set(fmt(d), 0);
    }
    for (const f of files) {
      const k = fmt(new Date(f.createdAt));
      if (byDay.has(k)) byDay.set(k, (byDay.get(k) || 0) + 1);
    }
    return Array.from(byDay.entries()).map(([k, v]) => ({ x: k, y: v }));
  }, [files]);

  const totalUploads = uploadsSeries.reduce((a, b) => a + b.y, 0);

  return (
    <div className="grid gap-4">
      {/* Επάνω σειρά στατιστικών */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Χρήστες" value={stats?.users ?? "—"} subtitle="Σύνολο εγγεγραμμένων" />
        <DashboardCard title="Εκκρεμείς εγκρίσεις" value={stats?.pending ?? "—"} subtitle="Αναμονή ενεργοποίησης" />
        <DashboardCard title="Αρχεία" value={stats?.files ?? "—"} subtitle="Σύνολο ανεβασμένων" />
        <DashboardCard title="Γρήγορες ενέργειες" subtitle="Συνηθισμένες εργασίες">
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/admin/users" className="rounded border px-3 py-1 text-sm">Διαχείριση χρηστών</Link>
            <Link href="/admin/uploads" className="rounded border px-3 py-1 text-sm">Ανέβασμα αρχείου</Link>
            <Link href="/admin/audit" className="rounded border px-3 py-1 text-sm">Προβολή καταγραφών</Link>
          </div>
        </DashboardCard>
      </div>

      {/* Τάση ανεβασμάτων + πρόσφατη δραστηριότητα */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardCard title="Ανεβάσματα — τελευταίες 30 ημέρες">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-[color:var(--muted)]">Καθημερινός αριθμός</span>
            <span className="text-xs text-[color:var(--muted)]">{totalUploads} σύνολο</span>
          </div>
          <TrendMini data={uploadsSeries} />
        </DashboardCard>

        <section className="lg:col-span-2 rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-0">
          {/* header (own padding) */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <h2 className="font-semibold">Πρόσφατη δραστηριότητα</h2>
            <Link href="/admin/audit" className="text-sm underline">Προβολή όλων</Link>
          </div>

          {/* body: padding + horizontal scroll for wide content */}
          <div className="px-4 pb-4 overflow-x-auto">
            {audit.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">Δεν υπάρχουν δραστηριότητες ακόμη.</p>
            ) : (
              <table className="min-w-[920px] w-full text-sm">
                <thead>
                  <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                    <th className="py-2 pr-3">Ώρα</th>
                    <th className="py-2 pr-3">Ενέργεια</th>
                    <th className="py-2 pr-3">Χρήστης</th>
                    <th className="py-2 pr-3">Στόχος</th>
                    <th className="py-2 pr-3">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 border-[color:var(--border)] align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 font-medium">{r.action}</td>
                      <td className="py-2 pr-3">
                        {r.actor ? (r.actor.email + (r.actor.name ? ` (${r.actor.name})` : "")) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {r.target ?? "—"} {r.targetId ? <span className="text-[color:var(--muted)]">#{r.targetId}</span> : null}
                      </td>
                      <td className="py-2 pr-3">
                        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words text-xs bg-black/5 rounded p-2">
                          {r.meta ? JSON.stringify(r.meta, null, 2) : "—"}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
