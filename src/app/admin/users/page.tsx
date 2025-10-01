"use client";
import useSWR from "swr";
import { useState } from "react";

const safeJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { error: text || res.statusText }; }
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  const body = await safeJson(res);
  if (!res.ok) {
    const msg = (body && (body.error || body.message)) || res.statusText;
    throw new Error(msg);
  }
  return body;
};

type UserRow = {
  id: string; email: string; name: string | null;
  role: "USER" | "ADMIN"; subscriptionActive: boolean; createdAt: string;
};

export default function AdminUsers() {
  const { data, isLoading, error, mutate } = useSWR<UserRow[]>("/api/admin/users", fetcher);
  const [form, setForm] = useState({ name: "", email: "", password: "", subscriptionActive: false });
  const [msg, setMsg] = useState("");

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await safeJson(res);
    if (!res.ok) {
      setMsg((body && (body.error || body.message)) || `Error ${res.status}`);
      return;
    }
    setMsg("User created");
    setForm({ name: "", email: "", password: "", subscriptionActive: false });
    mutate();
  }

  async function toggleSub(id: string, active: boolean) {
    const res = await fetch(`/api/admin/users/${id}/subscription`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    // ignore body here; we just refresh the list
    mutate();
  }

  // Loading
  if (isLoading) return <main className="p-6">Loading…</main>;

  // Not authorized or other error
  if (error) {
    const message = (error as Error).message || "Failed to load";
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Admin • Users</h1>
        <p className="mt-2">Error: {message}</p>
        <p className="mt-1 text-sm">
          If you’re not logged in as an admin, please <a className="underline" href="/login">sign in</a>.
        </p>
      </main>
    );
  }

  // Guard: ensure we have an array
  const rows: UserRow[] = Array.isArray(data) ? data : [];

  return (
    <main className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold">Admin • Users</h1>

      <section className="mt-6">
        <h2 className="font-medium mb-2">Create user</h2>
        <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-2xl p-4">
          <input className="border rounded p-2" placeholder="Name (optional)" value={form.name}
                 onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="border rounded p-2" type="email" required placeholder="Email" value={form.email}
                 onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="border rounded p-2 sm:col-span-2" type="password" required
                 placeholder="Password (min 8, upper+lower+number)"
                 value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.subscriptionActive}
                   onChange={e => setForm({ ...form, subscriptionActive: e.target.checked })} />
            Activate subscription now
          </label>
          <button className="bg-black text-white rounded px-4 py-2 w-max">Create</button>
          {msg && <p className="text-sm">{msg}</p>}
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-medium mb-2">All users</h2>
        <div className="overflow-x-auto border rounded-2xl">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-neutral-50">
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Role</th>
                <th className="text-left p-2">Subscription</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id} className="border-b">
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.name ?? "—"}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">{u.subscriptionActive ? "Active" : "Inactive"}</td>
                  <td className="p-2 text-center">
                    <button className="underline" onClick={() => toggleSub(u.id, u.subscriptionActive)}>
                      {u.subscriptionActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="p-3 text-center text-neutral-500">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
