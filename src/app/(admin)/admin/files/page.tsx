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

  // --- manual add state ---
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [savingNew, setSavingNew] = useState(false);

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

  async function createManual() {
    if (!newTitle.trim() || !newUrl.trim()) {
      alert("Συμπληρώστε Τίτλο και URL.");
      return;
    }
    setSavingNew(true);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          url: newUrl.trim(),
          assignTo: newAssignee || undefined, // optional
        }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Αποτυχία δημιουργίας αρχείου");
      }
      // reset + reload
      setNewTitle("");
      setNewUrl("");
      setNewAssignee("");
      await load();
    } catch (err: any) {
      alert(err?.message || "Σφάλμα");
    } finally {
      setSavingNew(false);
    }
  }

  return (
    <div className="grid gap-4 text-[inherit]">
      <h2 className="text-xl font-semibold">Όλα τα αρχεία</h2>

      {/* ===== MOBILE: Manual add card ===== */}
      <section className="sm:hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-3">
        <h3 className="mb-2 font-medium">Προσθήκη αρχείου (χειροκίνητα)</h3>
        <div className="grid gap-2">
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="Τίτλος"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="URL αρχείου (https://...)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
          />
          <select
            className="w-full border rounded px-2 py-1 bg-white/90"
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
          >
            <option value="">— Προαιρετική ανάθεση —</option>
            {users
              .filter((u) => u.status === "ACTIVE")
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}{u.name ? ` (${u.name})` : ""}
                </option>
              ))}
          </select>
          <button
            disabled={savingNew}
            onClick={createManual}
            className="rounded bg-[color:var(--brand,#25C3F4)] text-black px-3 py-2 font-medium hover:opacity-90 disabled:opacity-60"
          >
            {savingNew ? "Αποθήκευση…" : "Προσθήκη"}
          </button>
        </div>
      </section>

      {loading ? (
        <div className="text-sm text-[color:var(--muted)]">Φόρτωση…</div>
      ) : (
        <>
          {/* ===== DESKTOP/TABLET: Manual add mini-table ===== */}
          <section className="hidden sm:block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4">
            <h3 className="mb-3 font-medium">Προσθήκη αρχείου (χειροκίνητα)</h3>
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[36%]" /> {/* Τίτλος */}
                  <col className="w-[32%]" /> {/* URL */}
                  <col className="w-[20%]" /> {/* Ανάθεση σε */}
                  <col className="w-[12%]" /> {/* Ενέργειες */}
                </colgroup>
                <thead className="bg-gray-50 text-gray-700">
                  <tr className="text-left">
                    <Th>Τίτλος</Th>
                    <Th>URL</Th>
                    <Th>Ανάθεση σε</Th>
                    <Th className="text-right">Ενέργειες</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <Td>
                      <input
                        className="w-full border rounded px-2 py-1"
                        placeholder="Τίτλος"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                      />
                    </Td>
                    <Td>
                      <input
                        className="w-full border rounded px-2 py-1"
                        placeholder="URL αρχείου (https://...)"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                      />
                    </Td>
                    <Td>
                      <select
                        className="w-full border rounded px-2 py-1 bg-white/90"
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                      >
                        <option value="">— Καμία —</option>
                        {users
                          .filter((u) => u.status === "ACTIVE")
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.email}{u.name ? ` (${u.name})` : ""}
                            </option>
                          ))}
                      </select>
                    </Td>
                    <Td className="text-right">
                      <button
                        disabled={savingNew}
                        onClick={createManual}
                        className="inline-flex items-center rounded bg-[color:var(--brand,#25C3F4)] px-3 py-2 font-medium text-black hover:opacity-90 disabled:opacity-60"
                      >
                        {savingNew ? "Αποθήκευση…" : "Προσθήκη"}
                      </button>
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ===== MOBILE LIST (2 rows) ===== */}
          <section className="sm:hidden grid gap-3">
            {files.map((f) => {
              const assigned = (f.assignments || []).map((a) => a.user.email).join(", ");
              return (
                <div key={f.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-3">
                  {/* Row 1: Τίτλος + ημερομηνία + λήψη */}
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
                      onSubmit={(e) => {
                        e.preventDefault();
                        const userId = (new FormData(e.currentTarget).get("userId") as string) || "";
                        assign(f.id, userId);
                      }}
                      className="flex flex-wrap gap-2"
                    >
                      <select name="userId" className="flex-1 min-w-[50%] border rounded px-2 py-1 text-[inherit] bg-white/90">
                        <option value="">Επιλογή χρήστη…</option>
                        {users
                          .filter((u) => u.status === "ACTIVE")
                          .map((u) => (
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

          {/* ===== DESKTOP/TABLET TABLE ===== */}
          <section className="hidden sm:block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4">
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-sm text-[inherit]">
                {/* stabilize column widths so Actions doesn't get crowded */}
                <colgroup>
                  <col className="w-[35%]" />  {/* Τίτλος */}
                  <col className="w-[20%]" />  {/* Ημερομηνία δημιουργίας */}
                  <col className="w-[28%]" />  {/* Ανατεθειμένο σε */}
                  <col className="w-[15%]" />  {/* Ανάθεση */}
                  <col className="w-[12%]" />  {/* Ενέργειες */}
                </colgroup>

                <thead className="bg-gray-50 text-gray-700">
                  <tr className="text-left">
                    <Th>Τίτλος</Th>
                    <Th>Ημερομηνία δημιουργίας</Th>
                    <Th>Ανατεθειμένο σε</Th>
                    <Th>Ανάθεση</Th>
                    <Th className="text-right">Ενέργειες</Th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {files.map((f) => {
                    const assigned = (f.assignments || []).map((a) => a.user.email).join(", ");
                    return (
                      <tr key={f.id} className="align-top">
                        <Td className="whitespace-normal break-words">{f.title}</Td>
                        <Td className="whitespace-nowrap">{new Date(f.createdAt).toLocaleString()}</Td>
                        <Td className="whitespace-normal break-words">
                          {assigned ? assigned : <span className="text-[color:var(--muted)]">Δεν έχει ανατεθεί</span>}
                        </Td>
                        <Td>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const userId = (new FormData(e.currentTarget).get("userId") as string) || "";
                              assign(f.id, userId);
                            }}
                            className="flex gap-2"
                          >
                            <select name="userId" className="border rounded px-2 py-1 text-[inherit] bg-white/90">
                              <option value="">Επιλογή χρήστη…</option>
                              {users
                                .filter((u) => u.status === "ACTIVE")
                                .map((u) => (
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
                        <Td className="text-right w-[12%] whitespace-nowrap">
                          {f.url ? (
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block rounded border px-3 py-1 hover:bg-black/5"
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
