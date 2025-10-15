"use client";

import { useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
  subscriptionActive: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER" as "USER" | "ADMIN",
    subscriptionActive: false,
  });
  const canCreate = useMemo(() => {
    return form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && form.password.length >= 6;
  }, [form]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load users");
      setUsers(json.users);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleSubscription(u: User) {
    const optimistic = users.map(x => x.id === u.id ? { ...x, subscriptionActive: !u.subscriptionActive } : x);
    setUsers(optimistic);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionActive: !u.subscriptionActive }),
    });
    if (!res.ok) load(); // rollback by reload
  }

  async function changeRole(u: User, role: "USER" | "ADMIN") {
    const optimistic = users.map(x => x.id === u.id ? { ...x, role } : x);
    setUsers(optimistic);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) load();
  }

  async function remove(u: User) {
    if (!confirm(`Delete user ${u.email}? This cannot be undone.`)) return;
    const optimistic = users.filter(x => x.id !== u.id);
    setUsers(optimistic);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) load();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { alert(json?.error || "Failed to create user"); return; }
    setForm({ name: "", email: "", password: "", role: "USER", subscriptionActive: false });
    load();
  }

  return (
    <div className="grid gap-6">
      {/* Create user */}
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold mb-3">Create User</h2>
        <form onSubmit={createUser} className="grid gap-3 md:grid-cols-5">
          <input
            className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2 md:col-span-1"
            placeholder="Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="email"
            className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2 md:col-span-2"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="password"
            className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2 md:col-span-1"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
          />
          <div className="flex items-center gap-2 md:col-span-1">
            <select
              className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2"
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value as any })}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.subscriptionActive}
                onChange={e => setForm({ ...form, subscriptionActive: e.target.checked })}
              />
              Subscription
            </label>
          </div>
          <div className="md:col-span-5">
            <button
              type="submit"
              disabled={!canCreate}
              className="rounded-md bg-[color:var(--brand)] hover:bg-[color:var(--brand-600)] text-black font-medium px-4 py-2 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </section>

      {/* Users table */}
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Users</h2>
          <button
            onClick={load}
            className="rounded-md border border-[color:var(--border)] px-3 py-2 text-sm"
          >
            Refresh
          </button>
        </div>

        {err && (
          <div className="text-sm text-red-600 mb-3">{err}</div>
        )}

        {loading ? (
          <div className="text-sm text-[color:var(--muted)]">Loading…</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-[color:var(--muted)]">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Subscription</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b last:border-0 border-[color:var(--border)]">
                  <td className="py-2 pr-3">{u.name ?? "—"}</td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3">
                    <select
                      value={u.role}
                      onChange={e => changeRole(u, e.target.value as "USER" | "ADMIN")}
                      className="rounded-md border border-[color:var(--border)] bg-white/90 px-2 py-1"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={u.subscriptionActive}
                        onChange={() => toggleSubscription(u)}
                      />
                      {u.subscriptionActive ? "Active" : "Inactive"}
                    </label>
                  </td>
                  <td className="py-2 pr-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => remove(u)}
                      className="rounded-md border border-red-200 text-red-700 px-3 py-1 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
