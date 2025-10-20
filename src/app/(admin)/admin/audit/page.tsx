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

  async function load(next?: string | null) {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "50" });
      if (next) q.set("cursor", next);
      const r = await fetch(`/api/admin/audit?${q.toString()}`, { cache: "no-store" });
      const { items, nextCursor } = await r.json();
      setRows(prev => (next ? [...prev, ...items] : items));
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(null); }, []);

  return (
    <div className="grid gap-4 text-[inherit]">
      <h1 className="text-xl font-semibold">Αρχεία Καταγραφής</h1>

      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4">
        <div className="overflow-hidden">
          <table className="w-full table-fixed text-sm text-[inherit]">
            <thead className="bg-gray-50 text-gray-700">
              <tr className="text-left">
                <Th className="w-[20%]">Ώρα</Th>
                <Th className="w-[20%]">Ενέργεια</Th>
                <Th className="w-[20%] hidden sm:table-cell">Χρήστης</Th>
                <Th className="w-[20%] hidden md:table-cell">Στόχος</Th>
                <Th className="w-[20%]">Meta</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <Td className="whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</Td>

                  <Td className="font-medium whitespace-normal break-words">
                    {humanizeAction(r.action)}
                  </Td>

                  <Td className="hidden sm:table-cell whitespace-normal break-words">
                    {r.actor ? (
                      <>
                        {r.actor.email}
                        {r.actor.name ? <span className="text-gray-500"> ({r.actor.name})</span> : null}
                      </>
                    ) : "—"}
                  </Td>

                  <Td className="hidden md:table-cell whitespace-normal break-words">
                    {r.target ?? "—"}{" "}
                    {r.targetId ? <span className="text-[color:var(--muted)]">#{r.targetId}</span> : null}
                  </Td>

                  <Td className="whitespace-normal break-words">
                    <pre className="text-xs bg-black/5 rounded p-2 max-h-[12rem] overflow-auto">
                      {r.meta ? JSON.stringify(r.meta, null, 2) : "—"}
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
