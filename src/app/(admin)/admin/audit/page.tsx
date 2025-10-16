// src/app/(admin)/admin/audit/page.tsx
"use client";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  createdAt: string;
  action: string;
  target?: string | null;
  targetId?: string | null;
  actor?: { id: string; email: string; name?: string | null } | null;
  meta?: any;
};

export default function AdminAuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  async function load(next?: string | null) {
    setLoading(true);
    const q = new URLSearchParams({ limit: "50" });
    if (next) q.set("cursor", next);
    const r = await fetch(`/api/admin/audit?${q.toString()}`, { cache: "no-store" });
    const { items, nextCursor } = await r.json();
    setRows(prev => next ? [...prev, ...items] : items);
    setCursor(nextCursor);
    setHasMore(!!nextCursor);
    setLoading(false);
  }

  useEffect(() => { load(null); }, []);

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Αρχεία Καταγραφής</h1>

      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 overflow-x-auto">
        <table className="w-full text-sm">
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
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 border-[color:var(--border)] align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3 font-medium">{r.action}</td>
                <td className="py-2 pr-3">
                  {r.actor ? `${r.actor.email}${r.actor.name ? ` (${r.actor.name})` : ""}` : "—"}
                </td>
                <td className="py-2 pr-3">
                  {r.target ?? "—"} {r.targetId ? <span className="text-[color:var(--muted)]">#{r.targetId}</span> : null}
                </td>
                <td className="py-2 pr-3">
                  <pre className="max-w-[40ch] whitespace-pre-wrap break-words text-xs bg-black/5 rounded p-2">
                    {r.meta ? JSON.stringify(r.meta, null, 2) : "—"}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex justify-end">
          {hasMore && (
            <button
              onClick={() => load(cursor)}
              disabled={loading}
              className="rounded border border-[color:var(--border)] px-3 py-2 text-sm"
            >
              {loading ? "Φόρτωση…" : "Φόρτωση περισσότερων"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
