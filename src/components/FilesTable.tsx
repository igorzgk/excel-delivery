// src/components/FilesTable.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Folder, FileText, Plus, Pencil, Trash2 } from "lucide-react";

type FileItem = {
  id: string;
  title: string;
  originalName?: string | null;
  createdAt: string | Date;
  size?: number | null; // bytes
  url?: string | null;
  mime?: string | null; // IMPORTANT
  pdfFolderId?: string | null; // optional (if you added it)
};

type PdfFolder = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string | Date;
};

type Labels = {
  search: string;
  countSuffix: string;
  title: string;
  uploaded: string;
  size: string;
  action: string;
  download: string;
  empty: string;
};

function isPdfFile(f: FileItem) {
  const mime = (f.mime || "").toLowerCase();
  const name = `${f.originalName || ""} ${f.title || ""}`.toLowerCase();
  return mime.includes("application/pdf") || mime.includes("pdf") || name.includes(".pdf");
}

export default function FilesTable({
  initialFiles,
  labels,
}: {
  initialFiles: FileItem[];
  labels: Labels;
}) {
  const [query, setQuery] = useState("");
  const [files] = useState<FileItem[]>(initialFiles ?? []);

  // folders
  const [folders, setFolders] = useState<PdfFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  // ALL | NONE | folderId
  const [selectedFolderId, setSelectedFolderId] = useState<string>("ALL");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      setFoldersLoading(true);
      setFolderError(null);
      try {
        const res = await fetch("/api/pdf-folders", { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Αποτυχία φόρτωσης φακέλων");
        setFolders(j.folders || []);
      } catch (e: any) {
        setFolderError(e?.message || "Αποτυχία φόρτωσης φακέλων");
      } finally {
        setFoldersLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      const title = (f.title || "").toLowerCase();
      const original = (f.originalName || "").toLowerCase();
      return title.includes(q) || original.includes(q);
    });
  }, [files, query]);

  const nonPdfFiles = useMemo(() => filtered.filter((f) => !isPdfFile(f)), [filtered]);
  const allPdfFiles = useMemo(() => filtered.filter((f) => isPdfFile(f)), [filtered]);

  const pdfFiles = useMemo(() => {
    if (selectedFolderId === "ALL") return allPdfFiles;
    if (selectedFolderId === "NONE") return allPdfFiles.filter((f) => !f.pdfFolderId);
    return allPdfFiles.filter((f) => f.pdfFolderId === selectedFolderId);
  }, [allPdfFiles, selectedFolderId]);

  async function createFolder() {
    const name = prompt("Όνομα νέου φακέλου:");
    if (!name?.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/pdf-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Αποτυχία δημιουργίας φακέλου");
      setFolders((prev) => [j.folder, ...prev]);
      setSelectedFolderId(j.folder.id);
    } catch (e: any) {
      alert(e?.message || "Αποτυχία");
    } finally {
      setCreating(false);
    }
  }

  async function renameFolder(folderId: string) {
    const current = folders.find((f) => f.id === folderId);
    const name = prompt("Νέο όνομα φακέλου:", current?.name || "");
    if (!name?.trim()) return;

    try {
      const res = await fetch("/api/pdf-folders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folderId, name }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Αποτυχία μετονομασίας");
      setFolders((prev) => prev.map((f) => (f.id === folderId ? j.folder : f)));
    } catch (e: any) {
      alert(e?.message || "Αποτυχία");
    }
  }

  async function deleteFolder(folderId: string) {
    if (!confirm("Διαγραφή φακέλου; (τα PDF θα μείνουν χωρίς φάκελο)")) return;
    try {
      const res = await fetch("/api/pdf-folders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folderId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Αποτυχία διαγραφής");
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setSelectedFolderId("ALL");
    } catch (e: any) {
      alert(e?.message || "Αποτυχία");
    }
  }

  return (
    <div className="grid gap-4">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          className="w-full max-w-[520px] rounded-xl border px-3 py-2 text-sm"
        />
        <div className="shrink-0 text-sm text-gray-500">
          {filtered.length} {labels.countSuffix}
        </div>
      </div>

      {/* ======= 2 columns on lg, stacked on mobile/tablet ======= */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT: NON-PDF FILES */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold">Αρχεία ({nonPdfFiles.length})</div>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-2 sm:hidden">
            {nonPdfFiles.length === 0 ? (
              <div className="text-sm text-gray-500">{labels.empty}</div>
            ) : (
              nonPdfFiles.map((f) => {
                const dt = new Date(f.createdAt);
                return (
                  <div key={f.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium break-words">{f.title || "—"}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {dt.toLocaleDateString()} {dt.toLocaleTimeString()} · {formatSize(f.size)}
                      </div>
                    </div>
                    {f.url ? (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-black"
                        style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                      >
                        {labels.download}
                      </a>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            {nonPdfFiles.length === 0 ? (
              <div className="text-sm text-gray-500">{labels.empty}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[62%]" />
                    <col className="w-[24%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                  </colgroup>
                  <thead className="bg-gray-50 text-gray-700">
                    <tr className="text-left">
                      <th className="px-3 py-3 font-semibold">{labels.title}</th>
                      <th className="px-3 py-3 font-semibold">{labels.uploaded}</th>
                      <th className="px-3 py-3 font-semibold">{labels.size}</th>
                      <th className="px-3 py-3 font-semibold text-right">{labels.action}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {nonPdfFiles.map((f) => {
                      const dt = new Date(f.createdAt);
                      return (
                        <tr key={f.id} className="align-top">
                          <td className="px-3 py-3 break-words">{f.title || "—"}</td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">{formatSize(f.size)}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: PDF FILES + FOLDERS */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="font-semibold">PDF Αρχεία ({allPdfFiles.length})</div>

            <button
              type="button"
              onClick={createFolder}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
              title="Δημιουργία φακέλου"
            >
              <Plus size={16} /> Φάκελος
            </button>
          </div>

          {/* Mobile: folder dropdown */}
          <div className="sm:hidden mb-3">
            <select
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
            >
              <option value="ALL">Όλα</option>
              <option value="NONE">Χωρίς φάκελο</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {folderError ? <div className="mt-2 text-xs text-red-600">{folderError}</div> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
            {/* folders list (desktop) */}
            <aside className="hidden sm:block rounded-xl border bg-gray-50 p-2">
              {folderError ? (
                <div className="text-xs text-red-600 px-2 py-1">{folderError}</div>
              ) : null}

              <FolderRow
                active={selectedFolderId === "ALL"}
                label="Όλα"
                onClick={() => setSelectedFolderId("ALL")}
              />
              <FolderRow
                active={selectedFolderId === "NONE"}
                label="Χωρίς φάκελο"
                onClick={() => setSelectedFolderId("NONE")}
              />

              <div className="my-2 h-px bg-gray-200" />

              {foldersLoading ? (
                <div className="text-sm text-gray-500 px-2 py-1">Φόρτωση…</div>
              ) : folders.length === 0 ? (
                <div className="text-sm text-gray-500 px-2 py-1">Δεν υπάρχουν φάκελοι.</div>
              ) : (
                <div className="grid gap-1">
                  {folders.map((f) => (
                    <div
                      key={f.id}
                      className={[
                        "group flex items-center justify-between gap-2 rounded-lg px-2 py-2 cursor-pointer",
                        selectedFolderId === f.id ? "bg-white border" : "hover:bg-white/70",
                      ].join(" ")}
                      onClick={() => setSelectedFolderId(f.id)}
                      title={f.name}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <Folder size={16} className="shrink-0" />
                        <div className="truncate text-sm">{f.name}</div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            renameFolder(f.id);
                          }}
                          aria-label="Μετονομασία"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFolder(f.id);
                          }}
                          aria-label="Διαγραφή"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>

            {/* pdf list */}
            <div className="min-w-0">
              {pdfFiles.length === 0 ? (
                <div className="text-sm text-gray-500">Δεν βρέθηκαν αρχεία.</div>
              ) : (
                <div className="grid gap-2">
                  {pdfFiles.map((f) => {
                    const dt = new Date(f.createdAt);
                    return (
                      <div
                        key={f.id}
                        className="rounded-xl border p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="shrink-0" />
                            {/* ✅ ΜΟΝΟ title (όχι originalName) για να μην "φαίνεται διπλό" */}
                            <div className="font-medium break-words">{f.title || "PDF"}</div>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {dt.toLocaleDateString()} {dt.toLocaleTimeString()} ·{" "}
                            {formatSize(f.size)}
                          </div>
                        </div>

                        {f.url ? (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-black"
                            style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                          >
                            Λήψη
                          </a>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function FolderRow({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer",
        active ? "bg-white border" : "hover:bg-white/70",
      ].join(" ")}
      onClick={onClick}
    >
      <Folder size={16} className="shrink-0" />
      <span className="text-sm">{label}</span>
    </div>
  );
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
