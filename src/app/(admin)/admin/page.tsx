"use client";

import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [stats, setStats] = useState<{ users: number; pending: number; files: number } | null>(null);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/stats", { cache: "no-store" });
      if (s.ok) setStats(await s.json());
    })();
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold">Users</h2>
        <p className="text-3xl font-semibold mt-2">{stats?.users ?? "—"}</p>
        <p className="text-sm text-[color:var(--muted)]">Total registered</p>
      </section>

      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold">Pending approvals</h2>
        <p className="text-3xl font-semibold mt-2">{stats?.pending ?? "—"}</p>
        <p className="text-sm text-[color:var(--muted)]">Awaiting admin approval</p>
      </section>

      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold">Files</h2>
        <p className="text-3xl font-semibold mt-2">{stats?.files ?? "—"}</p>
        <p className="text-sm text-[color:var(--muted)]">Total uploaded</p>
      </section>

      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 lg:col-span-3">
        <h2 className="font-semibold">Recent activity</h2>
        <p className="text-sm text-[color:var(--muted)]">Coming next: audit log (uploads, assignments, approvals).</p>
      </section>
    </div>
  );
}
