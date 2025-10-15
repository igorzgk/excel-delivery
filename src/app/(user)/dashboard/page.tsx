"use client";

import { useEffect, useState } from "react";
type FileRow = { id: string; title: string; createdAt: string; uploadedBy: { id: string; name: string | null; email: string } | null };
type AssignmentRow = { id: string; note?: string | null; createdAt: string; file: { id: string; title: string; url?: string | null; originalName?: string | null } };

export default function UserDashboard() {
  const [stats, setStats] = useState<{ myFiles: number; myAssigned: number } | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/stats", { cache: "no-store" });
      if (s.ok) setStats(await s.json());
      const f = await fetch("/api/files?scope=mine", { cache: "no-store" });
      if (f.ok) setFiles((await f.json()).files);
      const a = await fetch("/api/assignments", { cache: "no-store" });
      if (a.ok) setAssignments((await a.json()).assignments);
    })();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold mb-1">Quick stats</h2>
        <p className="text-sm text-[color:var(--muted)]">Your files and assignments.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[color:var(--border)] p-3">
            <div className="text-xs text-[color:var(--muted)]">My uploads</div>
            <div className="text-2xl font-semibold">{stats?.myFiles ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-[color:var(--border)] p-3">
            <div className="text-xs text-[color:var(--muted)]">Assigned to me</div>
            <div className="text-2xl font-semibold">{stats?.myAssigned ?? "—"}</div>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold mb-2">My uploads</h2>
        {files.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No files yet.</p>
        ) : (
          <ul className="text-sm">
            {files.slice(0,6).map(f => (
              <li key={f.id} className="py-1 border-b last:border-0 border-[color:var(--border)]">
                {f.title} <span className="text-[color:var(--muted)]">· {new Date(f.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 md:col-span-2">
        <h2 className="font-semibold mb-2">Assignments to me</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No assignments yet.</p>
        ) : (
          <ul className="text-sm">
            {assignments.slice(0,8).map(a => (
              <li key={a.id} className="py-1 border-b last:border-0 border-[color:var(--border)]">
                <span className="font-medium">{a.file.title}</span>
                {a.note ? <span className="text-[color:var(--muted)]"> — {a.note}</span> : null}
                <span className="text-[color:var(--muted)]"> · {new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
