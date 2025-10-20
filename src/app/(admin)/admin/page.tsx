// src/app/(admin)/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = { users: number; pending: number; files: number };
type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  target?: string | null;
  targetId?: string | null;
  actor?: { id: string; email: string; name?: string | null } | null;
  meta?: any;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);

  useEffect(() => {
    // Στατιστικά
    (async () => {
      try {
        const r = await fetch("/api/stats", { cache: "no-store" });
        if (r.ok) setStats(await r.json());
      } catch {}
      setLoadingStats(false);
    })();

    // Πρόσφατη δραστηριότητα (20 εγγραφές)
    (async () => {
      try {
        const r = await fetch("/api/admin/audit?limit=20", { cache: "no-store" });
        if (r.ok) {
          const { items } = await r.json();
          setRows(items as AuditRow[]);
        }
      } catch {}
      setLoadingAudit(false);
    })();
  }, []);

  return (
    <div className="grid gap-4">
      {/* Επάνω κάρτες: 1-στήλη στο κινητό, 3-στήλες σε desktop */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm text-[inherit]">
        <Card
          title="Χρήστες"
          value={loadingStats || !stats ? "—" : stats.users.toLocaleString()}
          subtitle="Σύνολο εγγεγραμμένων"
        />
        <Card
          title="Εκκρεμείς εγκρίσεις"
          value={loadingStats || !stats ? "—" : stats.pending.toLocaleString()}
          subtitle="Αναμονή ενεργοποίησης"
        />
        <Card
          title="Αρχεία"
          value={loadingStats || !stats ? "—" : stats.files.toLocaleString()}
          subtitle="Σύνολο ανεβασμένων"
        />
      </div>

      {/* Γρήγορες ενέργειες */}
      <section className="rounded-2xl border border-[var(--border,#E5E7EB)] bg-[var(--card,#fff)] p-4">
        <div className="text-sm text-[var(--muted,#6B7280)]">Γρήγορες ενέργειες</div>
        <div className="text-xs text-[var(--muted,#6B7280)] mb-3">Συνηθισμένες εργασίες</div>
        <div className="flex flex-wrap gap-2">
          <LinkBtn href="/admin/users">Διαχείριση χρηστών</LinkBtn>
          <LinkBtn href="/admin/uploads">Ανέβασμα αρχείου</LinkBtn>
          <LinkBtn href="/admin/audit">Προβολή καταγραφών</LinkBtn>
          <LinkBtn href="/admin/files">Αρχεία</LinkBtn>
        </div>
      </section>

      {/* Πρόσφατη δραστηριότητα — ΠΙΝΑΚΑΣ ΦΙΛΙΚΟΣ ΣΕ ΚΙΝΗΤΟ */}
      <section className="rounded-2xl border border-[var(--border,#E5E7EB)] bg-[var(--card,#fff)]">
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <h2 className="text-base font-semibold text-[inherit]">Πρόσφατη δραστηριότητα</h2>
          <Link href="/admin/audit" className="text-sm underline underline-offset-4">
            Προβολή όλων
          </Link>
        </div>

        {loadingAudit ? (
          <div className="px-4 py-6 text-sm text-[var(--muted,#6B7280)]">Φόρτωση…</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[var(--muted,#6B7280)]">Δεν υπάρχουν δραστηριότητες ακόμη.</div>
        ) : (
          <div className="mt-3 overflow-hidden">
            {/* mobile-first table */}
            <table className="w-full table-fixed text-sm text-[inherit]">
              <thead className="bg-gray-50 text-gray-700">
                <tr className="text-left">
                  <Th className="w-[40%]">Ενέργεια</Th>
                  <Th className="w-[35%]">Χρήστης</Th>
                  <Th className="w-[25%] hidden sm:table-cell">Ώρα</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    {/* Ενέργεια + στόχος/λεπτομέρειες */}
                    <Td className="whitespace-normal break-words">
                      <div className="font-medium text-[inherit]">{humanizeAction(r.action)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {r.target ? r.target : "—"}
                        {r.targetId ? ` · ${r.targetId}` : ""}
                      </div>
                      {r.meta?.subject && (
                        <div className="text-xs text-gray-600 mt-1">{String(r.meta.subject).slice(0, 100)}</div>
                      )}
                    </Td>

                    {/* Χρήστης */}
                    <Td className="whitespace-normal break-words">
                      {r.actor?.name || r.actor?.email || "Σύστημα"}
                      {r.actor?.email && (
                        <div className="text-xs text-gray-500">{r.actor.email}</div>
                      )}
                    </Td>

                    {/* Ώρα (κρυφό στο κινητό) */}
                    <Td className="hidden sm:table-cell whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
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

/* --------------------- Βοηθητικά components --------------------- */

function Card({
  title,
  value,
  subtitle,
  right,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border border-[var(--border,#E5E7EB)] bg-[var(--card,#fff)] shadow-sm p-4"
      style={{ color: "var(--app-fg,#0A0F2C)" }} // force dark text inside the card
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          {/* muted (NOT white) */}
          <h3 className="text-xs font-medium" style={{ color: "var(--app-muted,#6B7280)" }}>
            {title}
          </h3>

          {value !== undefined && (
            <div className="text-3xl font-semibold mt-2" style={{ color: "var(--app-fg,#0A0F2C)" }}>
              {value}
            </div>
          )}

          {subtitle && (
            <p className="text-xs mt-1" style={{ color: "var(--app-muted,#6B7280)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </div>
    </section>
  );
}

function LinkBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 text-[inherit]">
      {children}
    </Link>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-3 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}

/** Μετατροπή κωδικών ενεργειών σε ανθρώπινους τίτλους (ελληνικά) */
function humanizeAction(a: string) {
  switch (a) {
    case "FILE_UPLOADED":
      return "Ανέβασμα αρχείου";
    case "FILE_ASSIGNED":
      return "Ανάθεση αρχείου";
    case "DOWNLOAD_GRANTED":
      return "Παραχώρηση λήψης";
    case "USER_CREATED":
      return "Δημιουργία χρήστη";
    case "APIKEY_CREATED":
      return "Δημιουργία API Key";
    case "APIKEY_REVOKED":
      return "Ανάκληση API Key";
    case "SUBSCRIPTION_TOGGLED":
      return "Εναλλαγή συνδρομής";
    case "SUPPORT_TICKET":
      return "Αίτημα υποστήριξης";
    default:
      return a;
  }
}
