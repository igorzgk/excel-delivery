"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string | null; email: string };
type Folder = { id: string; name: string; ownerId: string };

export default function AdminPdfFolders() {
  const [users, setUsers] = useState<User[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setUsers(j.users || []);
        setUserId(j.users?.[0]?.id || "");
      }
    })();
  }, []);

  async function loadFolders(targetUserId: string) {
    const res = await fetch("/api/pdf-folders", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      const all: Folder[] = j.folders || [];
      setFolders(all.filter((f) => f.ownerId === targetUserId));
    }
  }

  useEffect(() => {
    if (userId) loadFolders(userId);
  }, [userId]);

  async function createFolder() {
    if (!userId) return;
    const name = prompt("Όνομα φακέλου:")?.trim();
    if (!name) return;

    const res = await fetch("/api/pdf-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ownerId: userId }), // ✅ admin creates for user
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error === "folder_exists" ? "Υπάρχει ήδη." : "Αποτυχία.");
      return;
    }

    await loadFolders(userId);
  }

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">Χρήστης</label>
        <select
          className="rounded-xl border px-3 py-2 text-sm"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email} ({u.email})
            </option>
          ))}
        </select>

        <button className="rounded-xl border px-3 py-2 text-sm" onClick={createFolder}>
          + Νέος φάκελος
        </button>
      </div>

      <div className="text-sm text-gray-600">Φάκελοι χρήστη: {folders.length}</div>
      <ul className="list-disc pl-5 text-sm">
        {folders.map((f) => (
          <li key={f.id}>{f.name}</li>
        ))}
      </ul>
    </div>
  );
}
