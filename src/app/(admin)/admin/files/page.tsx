"use client";
import { useEffect, useState } from "react";

type FileRow = {
  id: string;
  title: string;
  createdAt: string;
  url?: string | null;
  assignments?: { user: { id: string; email: string; name?: string | null } }[];
};

type UserRow = { id: string; email: string; name: string | null; status?: string };

export default function AdminFilesPage() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const f = await fetch("/api/files?scope=all", { cache: "no-store" });
    if (f.ok) setFiles((await f.json()).files);
    const u = await fetch("/api/admin/users", { cache: "no-store" });
    if (u.ok) setUsers((await u.json()).users);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function assign(fileId: string, userId: string) {
    if (!userId) return;
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, userId }),
    });
    if (!res.ok) alert("Failed to assign"); else load();
  }

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">All Files</h2>
      {loading ? "Loading…" : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Created</th>
              <th className="py-2 pr-3">Assigned to</th>
              <th className="py-2 pr-3">Assign</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map(f => {
              const assigned = (f.assignments || []).map(a => a.user.email).join(", ");
              return (
                <tr key={f.id} className="border-b last:border-0 border-[color:var(--border)]">
                  <td className="py-2 pr-3">
                    {f.title}
                  </td>
                  <td className="py-2 pr-3">{new Date(f.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    {assigned ? assigned : <span className="text-[color:var(--muted)]">No user assigned</span>}
                  </td>
                  <td className="py-2 pr-3">
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        const userId = (new FormData(e.currentTarget).get("userId") as string) || "";
                        assign(f.id, userId);
                      }}
                      className="flex gap-2"
                    >
                      <select name="userId" className="border rounded px-2 py-1">
                        <option value="">Select user…</option>
                        {users
                          .filter(u => u.status === "ACTIVE")
                          .map(u => (
                            <option key={u.id} value={u.id}>
                              {u.email}{u.name ? ` (${u.name})` : ""}
                            </option>
                          ))}
                      </select>
                      <button className="rounded bg-[color:var(--brand)] text-black px-3 py-1">Assign</button>
                    </form>
                  </td>
                  <td className="py-2 pr-3">
                    {f.url ? (
                      <a href={f.url} target="_blank" rel="noreferrer" className="rounded border px-3 py-1 hover:bg-black/5">
                        Download
                      </a>
                    ) : (
                      <span className="text-[color:var(--muted)]">No file URL</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
