// src/components/FilesTable.tsx
"use client";

import { useMemo, useState } from "react";

type FileItem = {
  id: string;
  title: string;
  originalName?: string | null;
  createdAt: string | Date;
  size?: number | null;       // bytes
  url?: string | null;
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      const title = (f.title || "").toLowerCase();
      const original = (f.originalName || "").toLowerCase();
      return title.includes(q) || original.includes(q);
    });
  }, [files, query]);

  return (
    <div className="grid gap-4">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          className="w-full max-w-[420px] rounded-xl border px-3 py-2 text-sm"
        />
        <div className="shrink-0 text-sm text-gray-500">
          {filtered.length} {labels.countSuffix}
        </div>
      </div>

      {/* ======= MOBILE (cards: 2 rows) ======= */}
      <section className="grid gap-3 sm:hidden">
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-500">{labels.empty}</div>
        ) : (
          filtered.map((f) => {
            const dt = new Date(f.createdAt);
            return (
              <div
                key={f.id}
                className="rounded-2xl border bg-white p-3 shadow-sm"
              >
                {/* Row 1: Title + download */}
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

                {/* Row 2: Original + size */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="space-y-1">
                    <div className="text-gray-600">{labels.original}</div>
                    <div className="break-words">
                      {f.originalName || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-gray-600">{labels.size}</div>
                    <div>{formatSize(f.size)}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ======= TABLET / DESKTOP ======= */}
      <section className="hidden sm:block rounded-2xl border bg-white p-4">
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-500">{labels.empty}</div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full table-fixed text-sm">
              {/* keep consistent widths so buttons don’t overlap */}
              <colgroup>
                <col className="w-[36%]" /> {/* Title */}
                <col className="w-[26%]" /> {/* Original */}
                <col className="w-[18%]" /> {/* Uploaded */}
                <col className="w-[10%]" /> {/* Size */}
                <col className="w-[10%]" /> {/* Action */}
              </colgroup>
              <thead className="bg-gray-50 text-gray-700">
                <tr className="text-left">
                  <Th>{labels.title}</Th>
                  <Th>{labels.original}</Th>
                  <Th>{labels.uploaded}</Th>
                  <Th>{labels.size}</Th>
                  <Th className="text-right">{labels.action}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((f) => {
                  const dt = new Date(f.createdAt);
                  return (
                    <tr key={f.id} className="align-top">
                      <Td className="break-words">{f.title}</Td>
                      <Td className="break-words">{f.originalName || "—"}</Td>
                      <Td className="whitespace-nowrap">
                        {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                      </Td>
                      <Td className="whitespace-nowrap">{formatSize(f.size)}</Td>
                      <Td className="text-right whitespace-nowrap">
                        {f.url ? (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block rounded-lg px-3 py-1 font-semibold text-black"
                            style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                          >
                            {labels.download}
                          </a>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

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
