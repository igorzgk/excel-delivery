// src/app/(admin)/admin/support/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/Button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";

type Ticket = {
  id: string;
  createdAt: string | Date;
  subject: string;
  messagePreview: string;
  priority: "low" | "normal" | "high";
  from: { name?: string | null; email: string };
};

type ApiList = { tickets: Ticket[]; total: number; page: number; pages: number };

export default function AdminSupportPage() {
  // --- filters / state ---
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState<"all" | "low" | "normal" | "high">("all");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiList>({ tickets: [], total: 0, page: 1, pages: 1 });

  // --- load data (wire to your API) ---
  async function load(opts?: { page?: number }) {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (priority !== "all") params.set("priority", priority);
    params.set("order", order);
    params.set("page", String(opts?.page ?? page));

    const res = await fetch(`/api/admin/support?${params.toString()}`, { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as ApiList;
      setData(json);
      if (opts?.page) setPage(opts.page);
    }
    setLoading(false);
  }

  useEffect(() => {
    load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial

  const countLabel = useMemo(() => {
    const n = data.total ?? data.tickets.length;
    return `${n} σύνολο`;
  }, [data.total, data.tickets.length]);

  // --- helpers ---
  function badgeClass(p: Ticket["priority"]) {
    if (p === "high") return "bg-red-100 text-red-800";
    if (p === "low") return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Αιτήματα Υποστήριξης</h1>
      <div className="text-sm text-muted-foreground">{countLabel}</div>

      {/* -------- Toolbar (responsive) -------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
        <Input
          placeholder="Αναζήτηση θέμα, μήνυμα ή χρήστη…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:col-span-1"
        />

        <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Όλες οι προτεραιότητες" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλες οι προτεραιότητες</SelectItem>
            <SelectItem value="high">Υψηλή</SelectItem>
            <SelectItem value="normal">Κανονική</SelectItem>
            <SelectItem value="low">Χαμηλή</SelectItem>
          </SelectContent>
        </Select>

        <Select value={order} onValueChange={(v: any) => setOrder(v)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Νεότερα πρώτα" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Νεότερα πρώτα</SelectItem>
            <SelectItem value="oldest">Παλαιότερα πρώτα</SelectItem>
          </SelectContent>
        </Select>

        {/* FIX: brand-colored button (no black pill) */}
        <Button
          onClick={() => load({ page: 1 })}
          disabled={loading}
          className="sm:justify-self-end bg-[color:var(--brand,#0ea5e9)] text-black hover:opacity-90"
        >
          Εφαρμογή
        </Button>
      </div>

      {/* -------- Mobile: 2-row cards -------- */}
      <section className="grid gap-3 sm:hidden">
        {loading ? (
          <div className="text-sm text-muted-foreground">Φόρτωση…</div>
        ) : data.tickets.length === 0 ? (
          <div className="text-sm text-muted-foreground">Δεν βρέθηκαν αιτήματα.</div>
        ) : (
          data.tickets.map((t) => {
            const dt = new Date(t.createdAt);
            return (
              <div
                key={t.id}
                className="rounded-2xl border bg-card p-3 shadow-sm"
              >
                {/* Row 1: Date/time (left) — Priority (right) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs text-slate-600 leading-5">
                    {dt.toLocaleDateString()}{" "}
                    {dt.toLocaleTimeString()}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(
                      t.priority
                    )}`}
                  >
                    {t.priority === "high" ? "Υψηλή" : t.priority === "low" ? "Χαμηλή" : "Κανονική"}
                  </span>
                </div>

                {/* Row 2: Subject, From, Preview */}
                <div className="mt-2 space-y-1">
                  <div className="font-medium break-words">{t.subject}</div>
                  <div className="text-xs text-slate-700 break-words">
                    {t.from.name ? `${t.from.name} · ` : ""}
                    {t.from.email}
                  </div>
                  <div className="text-sm text-slate-600 break-words">
                    {t.messagePreview}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* -------- Desktop/Tablet: table -------- */}
      <section className="hidden sm:block rounded-2xl border bg-card p-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Φόρτωση…</div>
        ) : data.tickets.length === 0 ? (
          <div className="text-sm text-muted-foreground">Δεν βρέθηκαν αιτήματα.</div>
        ) : (
          <Table className="w-full table-fixed">
            {/* Stable widths like on /admin/files */}
            <colgroup>
              <col className="w-[18%]" /> {/* Ημερ./Ώρα */}
              <col />                     {/* Θέμα */}
              <col className="w-[24%]" /> {/* Από */}
              <col className="w-[12%]" /> {/* Προτεραιότητα */}
              <col className="w-[28%]" /> {/* Προεπισκόπηση */}
            </colgroup>

            <TableHeader>
              <TableRow className="text-slate-700">
                <TableHead className="px-4">Ημερ./Ώρα</TableHead>
                <TableHead className="px-4">Θέμα</TableHead>
                <TableHead className="px-4">Από</TableHead>
                <TableHead className="px-4">Προτεραιότητα</TableHead>
                <TableHead className="px-4">Προεπισκόπηση</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data.tickets.map((t) => {
                const dt = new Date(t.createdAt);
                return (
                  <TableRow key={t.id} className="align-top">
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="px-4 py-3 break-words">{t.subject}</TableCell>
                    <TableCell className="px-4 py-3 break-words">
                      <div className="text-sm">{t.from.name || "—"}</div>
                      <div className="text-xs text-slate-600">{t.from.email}</div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass(
                          t.priority
                        )}`}
                      >
                        {t.priority === "high" ? "Υψηλή" : t.priority === "low" ? "Χαμηλή" : "Κανονική"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 break-words">
                      {t.messagePreview}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination (simple) */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Σελίδα {data.page} από {data.pages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => load({ page: page - 1 })}
            >
              Προηγούμενη
            </Button>
            <Button
              variant="secondary"
              disabled={page >= data.pages || loading}
              onClick={() => load({ page: page + 1 })}
            >
              Επόμενη
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
