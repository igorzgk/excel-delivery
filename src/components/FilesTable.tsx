// src/components/FilesTable.tsx
"use client";

import { useMemo, useState } from "react";

type FileItem = {
  id: string;
  title: string;
  originalName?: string | null;
  createdAt: string | Date;
  size?: number | null; // bytes
  url?: string | null;
  mime?: string | null;
};

type Labels = {
  search: string;
  countSuffix: string;
  title: string;
  original: string;
  uploaded: string;
  size: string;
  action: string;
  download: string;
  empty: string;

  nonPdfColumnTitle: string;
  pdfColumnTitle: string;
};

export default function FilesTable({
  initialFiles,
  labels,
}: {
  initialFiles: FileItem[];
  labels: Labels;
}) {
  const [query, setQuery] = useState("");
  const [files] = useState<FileItem[]>(initialFiles ?? []);

  const { nonPdf, pdf } = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matches = (f: FileItem) => {
      if (!q) return true;
      const title = (f.title || "").toLowerCase();
      const original = (f.originalName || "").toLowerCase();
      const url = (f.url || "").toLowerCase();
      return title.includes(q) || original.includes(q) || url.includes(q);
    };

    const isPdf = (f: FileItem) => {
      const title = (f.title || "").toLowerCase();
      const name = (f.originalName || "").toLowerCase();
      const url = (f.url || "").toLowerCase();
      const mime = (f.mime || "").toLowerCase();
      return (
        mime === "application/pdf" ||
        title.endsWith(".pdf") ||
        name.endsWith(".pdf") ||
        url.includes(".pdf")
      );
    };

    const filtered = files.filter(matches);

    return {
      nonPdf: filtered.filter((f) => !isPdf(f)),
      pdf: filtered.filter((f) => isPdf(f)),
    };
  }, [files, query]);

  const totalCount = nonPdf.length + pdf.length;

  return (
    <div className="grid gap-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          className="w-full max-w-[520px] rounded-xl border px-3 py-2 text-sm"
        />
        <div className="shrink-0 text-sm text-gray-500">
          {totalCount} {labels.countSuffix}
        </div>
      </div>

      {/* ======= MOBILE: stacked ======= */}
      <section className="grid gap-4 sm:hidden">
        <ColumnCard title={`${labels.nonPdfColumnTitle} (${nonPdf.length})`}>
          <MobileCards items={nonPdf} labels={labels} />
        </ColumnCard>

        <ColumnCard title={`${labels.pdfColumnTitle} (${pdf.length})`}>
          <MobileCards items={pdf} labels={labels} />
        </ColumnCard>
      </section>

      {/* ======= DESKTOP: 2 columns, each has its own scroll for the table ======= */}
      <section className="hidden sm:grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ColumnCard title={`${labels.nonPdfColumnTitle} (${nonPdf.length})`}>
          <DesktopTable items={nonPdf} labels={labels} />
        </ColumnCard>

        <ColumnCard title={`${labels.pdfColumnTitle} (${pdf.length})`}>
          <DesktopTable items={pdf} labels={labels} />
        </ColumnCard>
      </section>
    </div>
  );
}

/* ---------------- UI blocks ---------------- */

function ColumnCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function MobileCards({ items, labels }: { items: FileItem[]; labels: Labels }) {
  if (items.length === 0) {
    return <div className="text-sm text-gray-500">{labels.empty}</div>;
  }

  return (
    <div className="grid gap-3">
      {items.map((f) => {
        const dt = new Date(f.createdAt);
        return (
          <div key={f.id} className="rounded-2xl border bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium break-words">{f.title}</div>
                <div className="text-xs text-gray-600">
                  {labels.uploaded}: {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                </div>
              </div>
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg px-3 py-1 text-sm font-semibold text-black"
                  style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                >
                  {labels.download}
                </a>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <div className="text-gray-600">{labels.original}</div>
                <div className="break-words">{f.originalName || "—"}</div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-600">{labels.size}</div>
                <div>{formatSize(f.size)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DesktopTable({ items, labels }: { items: FileItem[]; labels: Labels }) {
  if (items.length === 0) {
    return <div className="text-sm text-gray-500">{labels.empty}</div>;
  }

  return (
    <div className="grid gap-2">
      {/* header row */}
      <div className="hidden xl:grid grid-cols-[minmax(0,3fr)_minmax(170px,auto)_minmax(80px,auto)_minmax(110px,auto)] gap-3 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 rounded-xl">
        <div>{labels.title}</div>
        <div>{labels.uploaded}</div>
        <div>{labels.size}</div>
        <div className="text-right">{labels.action}</div>
      </div>

      {/* rows */}
      <div className="grid gap-2">
        {items.map((f) => {
          const dt = new Date(f.createdAt);

          return (
            <div key={f.id} className="rounded-2xl border bg-white px-3 py-3">
              {/* On xl: 4 columns like a table */}
              <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(170px,auto)_minmax(80px,auto)_minmax(110px,auto)]">
                {/* Title */}
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 xl:hidden">{labels.title}</div>
                  <div className="break-words font-medium">{f.title}</div>

                  {/* show original name as secondary line (instead of a column) */}
                  {!!f.originalName && (
                    <div className="mt-1 text-xs text-gray-500 break-words">
                      {f.originalName}
                    </div>
                  )}
                </div>

                {/* Uploaded */}
                <div className="xl:justify-self-start">
                  <div className="text-xs text-gray-500 xl:hidden">{labels.uploaded}</div>
                  <div className="text-sm whitespace-nowrap">
                    {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                  </div>
                </div>

                {/* Size (tight) */}
                <div className="xl:justify-self-start">
                  <div className="text-xs text-gray-500 xl:hidden">{labels.size}</div>
                  <div className="text-sm whitespace-nowrap">{formatSize(f.size)}</div>
                </div>

                {/* Action */}
                <div className="xl:justify-self-end">
                  <div className="text-xs text-gray-500 xl:hidden">{labels.action}</div>
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-lg px-3 py-1 font-semibold text-black"
                      style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                    >
                      {labels.download}
                    </a>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
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

function formatSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
