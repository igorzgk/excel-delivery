// src/app/(user)/files/page.tsx
"use client";
import { useEffect, useState } from "react";

type FileRow = {
  id: string;
  title: string;
  originalName?: string | null;
  url?: string | null;
  mime?: string | null;
  size?: number | null;
  createdAt: string;
};

export default function MyAssignedFilesPage() {
  const [rows, setRows] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/files?scope=assigned", { cache: "no-store" });
    if (r.ok) setRows((await r.json()).files);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 overflow-x-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Αρχεία που μου έχουν ανατεθεί</h2>
        <button onClick={load} className="rounded border border-[color:var(--border)] px-3 py-1 text-sm">Ανανέωση</button>
      </div>
      {loading ? (
        <div className="text-sm text-[color:var(--muted)]">Φόρτωση…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-[color:var(--muted)]">Δεν υπάρχουν ανατεθειμένα αρχεία ακόμη.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
              <th className="py-2 pr-3">Τίτλος</th>
              <th className="py-2 pr-3">Ανέβηκε</th>
              <th className="py-2 pr-3">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(f => (
              <tr key={f.id} className="border-b last:border-0 border-[color:var(--border)]">
                <td className="py-2 pr-3">
                  {f.title}
                  {f.originalName ? <span className="text-[color:var(--muted)]"> · {f.originalName}</span> : null}
                </td>
                <td className="py-2 pr-3">{new Date(f.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3">
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border px-3 py-1 hover:bg-black/5"
                    >
                      Λήψη
                    </a>
                  ) : (
                    <span className="text-[color:var(--muted)]">Δεν υπάρχει URL αρχείου</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
