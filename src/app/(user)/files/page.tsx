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
        <h2 className="font-semibold">Files assigned to me</h2>
        <button onClick={load} className="rounded border border-[color:var(--border)] px-3 py-1 text-sm">Refresh</button>
      </div>
      {loading ? (
        <div className="text-sm text-[color:var(--muted)]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-[color:var(--muted)]">No assigned files yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Uploaded</th>
              <th className="py-2 pr-3">Actions</th>
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
                      Download
                    </a>
                  ) : (
                    <span className="text-[color:var(--muted)]">No file URL</span>
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
