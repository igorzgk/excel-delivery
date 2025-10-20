// src/app/(admin)/admin/audit/page.tsx
"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  createdAt: string;
  action: string;
  target?: string | null;
  targetId?: string | null;
  actor?: { id: string; email: string; name?: string | null } | null;
  meta?: any;
};

export default function AdminAuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load(next?: string | null) {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ limit: "50" });
      if (next) q.set("cursor", next);
      const r = await fetch(`/api/admin/audit?${q.toString()}`, { cache: "no-store" });
      const { items, nextCursor } = await r.json();
      setRows(prev => (next ? [...prev, ...items] : items));
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch (e: any) {
      setErr(e.message || "Σφάλμα φόρτωσης");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(null); }, []);

  return (
    <div className="grid gap-4 text-[inherit]">
      <h1 className="text-xl font-semibold">Αρχεία Καταγραφής</h1>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {/* -------- MOBILE LIST (2 σειρές) -------- */}
      <section className="sm:hidden grid gap-3">
        {rows.map((r) => {
          const created = new Date(r.createdAt).toLocaleString();
          const actor = r.actor ? `${r.actor.email}${r.actor.name ? ` (${r.actor.name})` : ""}` : "—";
          const metaPreview = jsonPreview(r.meta);
          return (
            <div key={r.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-3">
              {/* Row 1: Action + time, and actor below */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium break-words">{humanizeAction(r.action)}</div>
                  <div className="text-xs text-gray-600 break-words">{actor}</div>
                </div>
                <div className="shrink-0 text-xs text-gray-600 whitespace-nowrap">{created}</div>
              </div>

              {/* Row 2: Target + meta preview */}
              <div className="mt-3 grid gap-2">
                <div className="text-sm break-words">
                  <span className="text-gray-600">Στόχος:</span>{" "}
                  {r.target ?? "—"} {r.targetId ? <span className="text-[color:var(--muted)]">#{r.targetId}</span> : null}
                </div>

                <pre className="text-xs bg-black/5 rounded p-2 max-h-[12rem] overflow-auto whitespace-pre-wrap break-words">
                  {metaPreview || "—"}
                </pre>
              </div>
            </div>
          );
        })}

        <div className="mt-1 flex justify-end">
          {hasMore && (
            <button
              onClick={() => load(cursor)}
              disabled={loading}
              className="rounded border border-[color:var(--border)] px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Φόρτωση…" : "Φόρτωση περισσότερων"}
            </button>
          )}
        </div>
      </section>

      {/* -------- DESKTOP/TABLET TABLE -------- */}
      <section className="hidden sm:block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4">
        <div className="overflow-hidden">
          <table className="w-full table-fixed text-sm text-[inherit]">
            <thead className="bg-gray-50 text-gray-700">
              <tr className="text-left">
                <Th className="w-[18%]">Ώρα</Th>
                <Th className="w-[18%]">Ενέργεια</Th>
                <Th className="w-[22%]">Χρήστης</Th>
                <Th className="w-[17%]">Στόχος</Th>
                <Th className="w-[25%]">Meta</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <Td className="whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</Td>
                  <Td className="font-medium whitespace-normal break-words">{humanizeAction(r.action)}</Td>
                  <Td className="whitespace-normal break-words">
                    {r.actor ? (
                      <>
                        {r.actor.email}
                        {r.actor.name ? <span className="text-gray-500"> ({r.actor.name})</span> : null}
                      </>
                    ) : "—"}
                  </Td>
                  <Td className="whitespace-normal break-words">
                    {r.target ?? "—"}{" "}
                    {r.targetId ? <span className="text-[color:var(--muted)]">#{r.targetId}</span> : null}
                  </Td>
                  <Td className="whitespace-normal break-words">
                    <pre className="text-xs bg-black/5 rounded p-2 max-h-[10rem] overflow-auto">
                      {jsonPreview(r.meta) || "—"}
                    </pre>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex justify-end">
          {hasMore && (
            <button
              onClick={() => load(cursor)}
              disabled={loading}
              className="rounded border border-[color:var(--border)] px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Φόρτωση…" : "Φόρτωση περισσότερων"}
            </button>
          )}
        </div>
      </section>
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

function humanizeAction(a: string) {
  switch (a) {
    case "FILE_UPLOADED": return "Ανέβασμα αρχείου";
    case "FILE_ASSIGNED": return "Ανάθεση αρχείου";
    case "DOWNLOAD_GRANTED": return "Παραχώρηση λήψης";
    case "USER_CREATED": return "Δημιουργία χρήστη";
    case "APIKEY_CREATED": return "Δημιουργία API Key";
    case "APIKEY_REVOKED": return "Ανάκληση API Key";
    case "SUBSCRIPTION_TOGGLED": return "Εναλλαγή συνδρομής";
    case "SUPPORT_TICKET": return "Αίτημα υποστήριξης";
    default: return a;
  }
}

function jsonPreview(meta: any) {
  if (!meta) return "";
  try {
    const s = JSON.stringify(meta, null, 2);
    // keep it compact for preview
    return s.length > 1000 ? s.slice(0, 1000) + " …" : s;
  } catch {
    return String(meta);
  }
}
