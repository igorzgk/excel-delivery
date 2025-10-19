// src/components/StatCards.tsx
"use client";

import * as React from "react";

type Stats = {
  users: { total: number; active: number };
  files: { total: number };
  assignments: { total: number };
};

export default function StatCards({ initial }: { initial?: Stats | null }) {
  const [stats, setStats] = React.useState<Stats | null>(initial ?? null);
  const [loading, setLoading] = React.useState(!initial);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initial) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/stats", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load stats");
        if (alive) setStats(json.stats);
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load stats");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [initial]);

  const muted = "text-[color:var(--muted)]";
  const cardClass =
    "rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4";

  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString() : "—");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Users */}
      <div className={cardClass}>
        <div className={`${muted} text-sm mb-3`}>Χρήστες</div>
        <div className="h-1 w-10 rounded bg-[color:var(--primary,#25C3F4)] mb-3" />
        <div className="text-sm">{loading ? "—" : `Σύνολο εγγεγραμμένων`}</div>
        <div className="mt-2 text-2xl font-semibold">
          {loading ? "—" : fmt(stats?.users?.total)}
        </div>
      </div>

      {/* Pending approvals (active vs total as a proxy) */}
      <div className={cardClass}>
        <div className={`${muted} text-sm mb-3`}>Εκκρεμείς εγκρίσεις</div>
        <div className="h-1 w-10 rounded bg-[color:var(--primary,#25C3F4)] mb-3" />
        <div className="text-sm">{loading ? "—" : `Αναμονή ενεργοποίησης`}</div>
        <div className="mt-2 text-2xl font-semibold">
          {loading || !stats ? "—" : fmt((stats.users.total ?? 0) - (stats.users.active ?? 0))}
        </div>
      </div>

      {/* Files */}
      <div className={cardClass}>
        <div className={`${muted} text-sm mb-3`}>Αρχεία</div>
        <div className="h-1 w-10 rounded bg-[color:var(--primary,#25C3F4)] mb-3" />
        <div className="text-sm">{loading ? "—" : `Σύνολο ανεβασμένων`}</div>
        <div className="mt-2 text-2xl font-semibold">
          {loading ? "—" : fmt(stats?.files?.total)}
        </div>
      </div>

      {/* Error helper (non-blocking) */}
      {error && (
        <div className="md:col-span-3 text-xs text-red-600">
          Δεν ήταν δυνατή η φόρτωση των στατιστικών: {error}
        </div>
      )}
    </div>
  );
}
