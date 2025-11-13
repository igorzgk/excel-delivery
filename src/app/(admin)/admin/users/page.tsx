// src/app/(admin)/admin/users/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  const [filter, setFilter] =
    useState<"ALL" | "PENDING" | "ACTIVE" | "SUSPENDED">("ALL");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER" as "USER" | "ADMIN",
    subscriptionActive: false,
  });

  const canCreate = useMemo(() => {
    return (
      form.name.trim().length >= 2 &&
      /\S+@\S+\.\S+/.test(form.email) &&
      form.password.length >= 6
    );
  }, [form]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const q = filter === "ALL" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/users${q}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Αποτυχία φόρτωσης χρηστών");
      setUsers(json.users);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filter]);

  useEffect(() => {
    load();
  }, []);

  async function toggleSubscription(u: User) {
    const optimistic = users.map((x) =>
      x.id === u.id
        ? { ...x, subscriptionActive: !u.subscriptionActive }
        : x
    );
    setUsers(optimistic);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionActive: !u.subscriptionActive }),
    });
    if (!res.ok) load();
  }

  async function changeRole(u: User, role: "USER" | "ADMIN") {
    const optimistic = users.map((x) => (x.id === u.id ? { ...x, role } : x));
    setUsers(optimistic);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) load();
  }

  async function remove(u: User) {
    if (
      !confirm(
        `Διαγραφή χρήστη ${u.email}; Η ενέργεια δεν μπορεί να αναιρεθεί.`
      )
    )
      return;
    const optimistic = users.filter((x) => x.id !== u.id);
    setUsers(optimistic);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "DELETE",
    });
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
    if (!res.ok) {
      alert(json?.error || "Αποτυχία δημιουργίας χρήστη");
      return;
    }
    setForm({
      name: "",
      email: "",
      password: "",
      role: "USER",
      subscriptionActive: false,
    });
    load();
  }

  async function setStatus(u: User, status: User["status"]) {
    const optimistic = users.map((x) =>
      x.id === u.id ? { ...x, status } : x
    );
    setUsers(optimistic);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) load();
  }

  return (
    <div className="grid gap-6 text-[inherit]">
      {/* Φίλτρα */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", "PENDING", "ACTIVE", "SUSPENDED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-md border px-3 py-2 text-sm",
              filter === f
                ? "bg-[color:var(--brand)] text-black border-transparent"
                : "border-[color:var(--border)]",
            ].join(" ")}
          >
            {f === "ALL"
              ? "Όλοι"
              : f === "PENDING"
              ? "ΕΚΚΡΕΜΕΙ"
              : f === "ACTIVE"
              ? "ΕΝΕΡΓΟΣ"
              : "ΑΝΑΣΤΟΛΗ"}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={load}
            className="rounded-md border border-[color:var(--border)] px-3 py-2 text-sm"
          >
            Ανανέωση
          </button>
        </div>
      </div>

      {/* Δημιουργία χρήστη */}
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4">
        <h2 className="font-semibold mb-3 text-[inherit]">Δημιουργία Χρήστη</h2>
        <form onSubmit={createUser} className="grid gap-3 md:grid-cols-5">
          <input
            className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2 md:col-span-1 text-[inherit]"
            placeholder="Όνομα"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="email"
            className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2 md:col-span-2 text-[inherit]"
            placeholder="Ηλεκτρονικό ταχυδρομείο"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="password"
            className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2 md:col-span-1 text-[inherit]"
            placeholder="Κωδικός πρόσβασης"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <div className="flex items-center gap-2 md:col-span-1">
            <select
              className="rounded-md border border-[color:var(--border)] bg-white/90 px-3 py-2 text-[inherit]"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as "USER" | "ADMIN" })
              }
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.subscriptionActive}
                onChange={(e) =>
                  setForm({
                    ...form,
                    subscriptionActive: e.target.checked,
                  })
                }
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

      {/* --- MOBILE LIST (2 σειρές) --- */}
      <section className="sm:hidden grid gap-3">
        {err ? (
          <div className="text-sm text-red-600">{err}</div>
        ) : loading ? (
          <div className="text-sm text-[color:var(--muted)]">Φόρτωση…</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-[color:var(--muted)]">
            Δεν βρέθηκαν χρήστες.
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-3"
            >
              {/* Row 1: Όνομα / Email */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium break-words">
                    {u.name || "—"}
                  </div>
                  <div className="text-xs text-gray-600 break-words">
                    {u.email}
                  </div>
                </div>

                {/* Κατάσταση pill */}
                <span
                  className={[
                    "nowrap inline-flex items-center rounded-full px-2 py-0.5 border text-xs",
                    u.status === "ACTIVE"
                      ? "border-green-300 text-green-700 bg-green-50"
                      : u.status === "PENDING"
                      ? "border-amber-300 text-amber-700 bg-amber-50"
                      : "border-red-300 text-red-700 bg-red-50",
                  ].join(" ")}
                >
                  {u.status === "ACTIVE"
                    ? "ΕΝΕΡΓΟΣ"
                    : u.status === "PENDING"
                    ? "ΕΚΚΡΕΜΕΙ"
                    : "ΑΝΑΣΤΟΛΗ"}
                </span>
              </div>

              {/* Row 2 */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <select
                  value={u.role}
                  onChange={(e) =>
                    changeRole(u, e.target.value as "USER" | "ADMIN")
                  }
                  className="w-full rounded-md border border-[color:var(--border)] bg-white/90 px-2 py-1 text-[inherit]"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={u.subscriptionActive}
                    onChange={() => toggleSubscription(u)}
                    disabled={u.status !== "ACTIVE"}
                  />
                  <span className="text-sm">
                    {u.subscriptionActive ? "Ενεργό" : "Ανενεργό"}
                  </span>
                </label>

                {/* Mobile actions */}
                <div className="col-span-2 flex flex-wrap gap-2">
                  {u.status !== "ACTIVE" && (
                    <button
                      onClick={() => setStatus(u, "ACTIVE")}
                      className="rounded-md bg-green-600/90 text-white px-3 py-1 hover:bg-green-700 text-xs"
                    >
                      Έγκριση
                    </button>
                  )}
                  {u.status === "ACTIVE" && (
                    <button
                      onClick={() => setStatus(u, "SUSPENDED")}
                      className="rounded-md bg-yellow-500/90 text-black px-3 py-1 hover:bg-yellow-500 text-xs"
                    >
                      Αναστολή
                    </button>
                  )}

                  <button
                    onClick={() => remove(u)}
                    className="rounded-md border border-red-200 text-red-700 px-3 py-1 hover:bg-red-50 text-xs"
                  >
                    Διαγραφή
                  </button>

                  {/* PROFILE LINK — MOBILE */}
                  <Link
                    href={`/admin/users/${u.id}/profile`}
                    className="rounded-md border border-[color:var(--border)] px-3 py-1 text-xs underline text-[color:var(--brand,#25C3F4)]"
                  >
                    Προφίλ
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      {/* --- DESKTOP/TABLET TABLE --- */}
      <section className="hidden sm:block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4">
        {err ? (
          <div className="text-sm text-red-600">{err}</div>
        ) : loading ? (
          <div className="text-sm text-[color:var(--muted)]">Φόρτωση…</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-[color:var(--muted)]">
            Δεν βρέθηκαν χρήστες.
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full table-fixed text-sm text-[inherit]">
              <thead className="bg-gray-50 text-gray-700">
                <tr className="text-left">
                  <Th className="w-[20%]">Όνομα</Th>
                  <Th className="w-[25%]">Email</Th>
                  <Th className="w-[15%]">Ρόλος</Th>
                  <Th className="w-[15%]">Κατάσταση</Th>
                  <Th className="w-[15%]">Συνδρομή</Th>
                  <Th className="w-[10%]">Δημιουργήθηκε</Th>
                  <Th className="w-[20%]">Ενέργειες</Th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="align-top">
                    <Td className="whitespace-normal break-words">
                      {u.name ?? "—"}
                    </Td>
                    <Td className="whitespace-normal break-words">
                      {u.email}
                    </Td>

                    {/* Ρόλος */}
                    <Td>
                      <select
                        value={u.role}
                        onChange={(e) =>
                          changeRole(u, e.target.value as "USER" | "ADMIN")
                        }
                        className="rounded-md border border-[color:var(--border)] bg-white/90 px-2 py-1 text-[inherit]"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </Td>

                    {/* Κατάσταση */}
                    <Td>
                      <span
                        className={[
                          "nowrap inline-flex items-center rounded-full px-2 py-0.5 border text-xs",
                          u.status === "ACTIVE"
                            ? "border-green-300 text-green-700 bg-green-50"
                            : u.status === "PENDING"
                            ? "border-amber-300 text-amber-700 bg-amber-50"
                            : "border-red-300 text-red-700 bg-red-50",
                        ].join(" ")}
                      >
                        {u.status === "ACTIVE"
                          ? "ΕΝΕΡΓΟΣ"
                          : u.status === "PENDING"
                          ? "ΕΚΚΡΕΜΕΙ"
                          : "ΑΝΑΣΤΟΛΗ"}
                      </span>
                    </Td>

                    {/* Συνδρομή */}
                    <Td>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={u.subscriptionActive}
                          onChange={() => toggleSubscription(u)}
                          disabled={u.status !== "ACTIVE"}
                        />
                        {u.subscriptionActive ? "Ενεργό" : "Ανενεργό"}
                      </label>
                    </Td>

                    {/* Created */}
                    <Td className="whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </Td>

                    {/* Actions */}
                    <Td>
                      <div className="flex flex-wrap gap-2">

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

                        {/* PROFILE LINK — LAST BUTTON (DESKTOP) */}
                        <Link
                          href={`/admin/users/${u.id}/profile`}
                          className="rounded-md border border-[color:var(--border)] px-3 py-1 underline text-[color:var(--brand,#25C3F4)]"
                        >
                          Προφίλ
                        </Link>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* helpers */
function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-3 py-3 font-semibold ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}
