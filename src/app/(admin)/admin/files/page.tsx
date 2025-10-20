// src/app/(admin)/admin/files/page.tsx
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
    if (!res.ok) alert("Αποτυχία ανάθεσης"); else load();
  }

  return (
    <div className="grid gap-4 text-[inherit]">
      <h2 className="text-xl font-semibold">Όλα τα αρχεία</h2>

      {loading ? (
        <div className="text-sm text-[color:var(--muted)]">Φόρτωση…</div>
      ) : (
        <>
          {/* --- MOBILE LIST (2 σειρές) --- */}
          <section className="sm:hidden grid gap-3">
            {files.map((f) => {
              const assigned = (f.assignments || []).map(a => a.user.email).join(", ");
              return (
                <div key={f.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-3">
                  {/* Row 1: Τίτλος + (προαιρετικά) ημερομηνία */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium break-words">{f.title}</div>
                      <div className="text-xs text-gray-600">{new Date(f.createdAt).toLocaleString()}</div>
                    </div>
                    {f.url ? (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded border px-3 py-1 hover:bg-black/5"
                      >
                        Λήψη
                      </a>
                    ) : null}
                  </div>

                  {/* Row 2: Assigned + assign form */}
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <div className="text-sm whitespace-normal break-words">
                      <span className="text-gray-600">Ανατεθειμένο σε:</span>{" "}
                      {assigned || <span className="text-[color:var(--muted)]">Δεν έχει ανατεθεί</span>}
                    </div>

                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        const userId = (new FormData(e.currentTarget).get("userId") as string) || "";
                        assign(f.id, userId);
                      }}
                      className="flex flex-wrap gap-2"
                    >
                      <select name="userId" className="flex-1 min-w-[50%] border rounded px-2 py-1 text-[inherit] bg-white/90">
                        <option value="">Επιλογή χρήστη…</option>
                        {users
                          .filter(u => u.status === "ACTIVE")
                          .map(u => (
                            <option key={u.id} value={u.id}>
                              {u.email}{u.name ? ` (${u.name})` : ""}
                            </option>
                          ))}
                      </select>
                      <button className="rounded bg-[color:var(--brand)] text-black px-3 py-1 hover:opacity-90">
                        Ανάθεση
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </section>

          {/* --- DESKTOP/TABLET TABLE --- */}
          <section className="hidden sm:block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4">
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-sm text-[inherit]">
                <thead className="bg-gray-50 text-gray-700">
                  <tr className="text-left">
                    <Th className="w-[35%]">Τίτλος</Th>
                    <Th className="w-[20%]">Ημερομηνία δημιουργίας</Th>
                    <Th className="w-[25%]">Ανατεθειμένο σε</Th>
                    <Th className="w-[20%]">Ανάθεση</Th>
                    <Th className="w-[15%]">Ενέργειες</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {files.map(f => {
                    const assigned = (f.assignments || []).map(a => a.user.email).join(", ");
                    return (
                      <tr key={f.id} className="align-top">
                        <Td className="whitespace-normal break-words">{f.title}</Td>
                        <Td className="whitespace-nowrap">{new Date(f.createdAt).toLocaleString()}</Td>
                        <Td className="whitespace-normal break-words">
                          {assigned ? assigned : <span className="text-[color:var(--muted)]">Δεν έχει ανατεθεί</span>}
                        </Td>
                        <Td>
                          <form
                            onSubmit={e => {
                              e.preventDefault();
                              const userId = (new FormData(e.currentTarget).get("userId") as string) || "";
                              assign(f.id, userId);
                            }}
                            className="flex gap-2"
                          >
                            <select name="userId" className="border rounded px-2 py-1 text-[inherit] bg-white/90">
                              <option value="">Επιλογή χρήστη…</option>
                              {users
                                .filter(u => u.status === "ACTIVE")
                                .map(u => (
                                  <option key={u.id} value={u.id}>
                                    {u.email}{u.name ? ` (${u.name})` : ""}
                                  </option>
                                ))}
                            </select>
                            <button className="rounded bg-[color:var(--brand)] text-black px-3 py-1 hover:opacity-90">
                              Ανάθεση
                            </button>
                          </form>
                        </Td>
                        <Td>
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
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* helpers */
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-3 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}
