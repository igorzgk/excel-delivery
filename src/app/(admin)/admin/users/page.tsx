// src/app/(admin)/admin/users/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
  subscriptionActive: boolean;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "ACTIVE" | "SUSPENDED">("ALL");

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
    setLoading(true); setErr(null);
    try {
      const q = filter === "ALL" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/users${q}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Αποτυχία φόρτωσης χρηστών");
      setUsers(json.users);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [filter]);
  useEffect(() => { load(); }, []);

  async function toggleSubscription(u: User) {
    const optimistic = users.map(x => x.id === u.id ? { ...x, subscriptionActive: !u.subscriptionActive } : x);
    setUsers(optimistic);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionActive: !u.subscriptionActive }),
    });
    if (!res.ok) load();
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
    if (!confirm(`Διαγραφή χρήστη ${u.email}; Η ενέργεια δεν μπορεί να αναιρεθεί.`)) return;
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
    if (!res.ok) { alert(json?.error || "Αποτυχία δημιουργίας χρήστη"); return; }
    setForm({ name: "", email: "", password: "", role: "USER", subscriptionActive: false });
    load();
  }

  async function setStatus(u: User, status: User["status"]) {
    const optimistic = users.map(x => x.id === u.id ? { ...x, status } : x);
    setUsers(optimistic);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) load();
  }

  return (
    <div className="grid gap-6">
      {/* Φίλτρα */}
      <div className="flex gap-2">
        {(["ALL","PENDING","ACTIVE","SUSPENDED"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-md border px-3 py-2 text-sm",
              filter === f
                ? "bg-[color:var(--brand)] text-black border-transparent"
                : "border-[color:var(--border)]"
            ].join(" ")}
          >
            {f === "ALL" ? "Όλοι" : f === "PENDING" ? "ΕΚΚΡΕΜΕΙ" : f === "ACTIVE" ? "ΕΝΕΡΓΟΣ" : "ΑΝΑΣΤΟΛΗ"}
          </button>
        ))}
        <div className="ml-auto">
          <button onClick={load} className="rounded-md border border-[color:var(--border)] px-3 py-2 text-sm">Ανανέωση</button>
        </div>
      </div>

      {/* Δημιουργία χρήστη */}
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <h2 className="font-semibold mb-3">Δημιουργία Χρήστη</h2>
        <form onSubmit={createUser} className="grid gap-3 md:grid-cols-5">
          <input
            className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2 md:col-span-1"
            placeholder="Όνομα"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="email"
            className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2 md:col-span-2"
            placeholder="Ηλεκτρονικό ταχυδρομείο"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="password"
            className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2 md:col-span-1"
            placeholder="Κωδικός πρόσβασης"
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
              Συνδρομή
            </label>
          </div>
          <div className="md:col-span-5">
            <button
              type="submit"
              disabled={!canCreate}
              className="rounded-md bg-[color:var(--brand)] hover:bg-[color:var(--brand-600)] text-black font-medium px-4 py-2 disabled:opacity-50"
            >
              Δημιουργία
            </button>
          </div>
        </form>
      </section>

      {/* Πίνακας χρηστών */}
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] p-4 overflow-x-auto">
        {err ? (
          <div className="text-sm text-red-600">{err}</div>
        ) : loading ? (
          <div className="text-sm text-[color:var(--muted)]">Φόρτωση…</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-[color:var(--muted)]">Δεν βρέθηκαν χρήστες.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                <th className="py-2 pr-3">Όνομα</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Ρόλος</th>
                <th className="py-2 pr-3">Κατάσταση</th>
                <th className="py-2 pr-3">Συνδρομή</th>
                <th className="py-2 pr-3">Δημιουργήθηκε</th>
                <th className="py-2 pr-3">Ενέργειες</th>
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
                    <span className={[
                      "inline-flex items-center rounded-full px-2 py-0.5 border",
                      u.status === "ACTIVE" ? "border-green-300 text-green-700 bg-green-50" :
                      u.status === "PENDING" ? "border-amber-300 text-amber-700 bg-amber-50" :
                      "border-red-300 text-red-700 bg-red-50"
                    ].join(" ")}>
                      {u.status === "ACTIVE" ? "ΕΝΕΡΓΟΣ" : u.status === "PENDING" ? "ΕΚΚΡΕΜΕΙ" : "ΑΝΑΣΤΟΛΗ"}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={u.subscriptionActive}
                        onChange={() => toggleSubscription(u)}
                        disabled={u.status !== "ACTIVE"}
                      />
                      {u.subscriptionActive ? "Ενεργό" : "Ανενεργό"}
                    </label>
                  </td>
                  <td className="py-2 pr-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-3 flex gap-2">
                    {u.status !== "ACTIVE" && (
                      <button
                        onClick={() => setStatus(u, "ACTIVE")}
                        className="rounded-md bg-green-600/90 text-white px-3 py-1 hover:bg-green-700"
                      >
                        Έγκριση
                      </button>
                    )}
                    {u.status === "ACTIVE" && (
                      <button
                        onClick={() => setStatus(u, "SUSPENDED")}
                        className="rounded-md bg-yellow-500/90 text-black px-3 py-1 hover:bg-yellow-500"
                      >
                        Αναστολή
                      </button>
                    )}
                    <button
                      onClick={() => remove(u)}
                      className="rounded-md border border-red-200 text-red-700 px-3 py-1 hover:bg-red-50"
                    >
                      Διαγραφή
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
