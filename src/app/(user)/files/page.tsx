"use client";
import { useEffect, useState } from "react";

export default function MyFilesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/files?scope=mine", { cache: "no-store" });
    if (r.ok) setRows((await r.json()).files);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
      <h2 className="font-semibold mb-2">My uploads</h2>
      {loading ? "Loading…" : rows.length === 0 ? "No files yet." : (
        <ul className="text-sm">
          {rows.map(f => (
            <li key={f.id} className="py-1 border-b last:border-0 border-[color:var(--border)]">
              {f.title} {f.url ? <a className="underline ml-2" href={f.url} target="_blank">open</a> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
