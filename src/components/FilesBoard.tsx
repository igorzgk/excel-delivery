"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Folder, FileText, Plus, Pencil, Trash2, Upload } from "lucide-react";

type FileItem = {
  id: string;
  title: string;
  originalName?: string | null;
  createdAt: string | Date;
  size?: number | null;
  url?: string | null;
  mime?: string | null;
  pdfFolderId?: string | null;
};

type FolderItem = {
  id: string;
  name: string;
};

function isPdfFile(f: FileItem) {
  const mime = (f.mime || "").toLowerCase();
  const name = (f.originalName || "").toLowerCase();
  const title = (f.title || "").toLowerCase();
  if (mime.includes("pdf")) return true;
  if (name.endsWith(".pdf") || name.includes(".pdf")) return true;
  if (title.endsWith(".pdf") || title.includes(".pdf")) return true;
  return false;
}

function filenameWithoutExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

export default function FilesBoard({ initialFiles }: { initialFiles: FileItem[] }) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileItem[]>(initialFiles ?? []);

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("ALL");
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [creating, setCreating] = useState(false);

  // user upload state
  const [newTitle, setNewTitle] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      const t = (f.title || "").toLowerCase();
      const o = (f.originalName || "").toLowerCase();
      return t.includes(q) || o.includes(q);
    });
  }, [files, query]);

  const { pdfs, others } = useMemo(() => {
    const p = filtered.filter(isPdfFile);
    const o = filtered.filter((x) => !isPdfFile(x));
    return { pdfs: p, others: o };
  }, [filtered]);

  const pdfsFilteredByFolder = useMemo(() => {
    if (folderFilter === "ALL") return pdfs;
    if (folderFilter === "NONE") return pdfs.filter((p) => !p.pdfFolderId);
    return pdfs.filter((p) => p.pdfFolderId === folderFilter);
  }, [pdfs, folderFilter]);

  async function refreshFiles() {
    const res = await fetch("/api/files", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setFiles(j.files || []);
    }
  }

  async function loadFolders() {
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/pdf-folders", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setFolders(j.folders || []);
    } finally {
      setLoadingFolders(false);
    }
  }

  useEffect(() => {
    loadFolders();
  }, []);

  async function uploadMyFile() {
    if (!newTitle.trim() || !newFile) {
      alert("Συμπληρώστε τίτλο και επιλέξτε αρχείο.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", newTitle.trim());
      fd.append("file", newFile);

      const res = await fetch("/api/files", {
        method: "POST",
        body: fd,
      });

      const txt = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(txt || "Αποτυχία upload");
      }

      setNewTitle("");
      setNewFile(null);

      const fileInput = document.getElementById("user-file-upload-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      await refreshFiles();
    } catch (e: any) {
      alert(e?.message || "Αποτυχία upload");
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(fileId: string) {
    if (!confirm("Διαγραφή αρχείου;")) return;

    setDeletingId(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Αποτυχία διαγραφής");

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (e: any) {
      alert(e?.message || "Αποτυχία διαγραφής");
    } finally {
      setDeletingId(null);
    }
  }

  async function createFolder() {
    const name = prompt("Όνομα φακέλου (PDF):")?.trim();
    if (!name) return;

    setCreating(true);
    try {
      const res = await fetch("/api/pdf-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error === "folder_exists" ? "Ο φάκελος υπάρχει ήδη." : "Αποτυχία δημιουργίας φακέλου.");
        return;
      }
      await loadFolders();
      setFolderFilter(j.folder?.id || "ALL");
    } finally {
      setCreating(false);
    }
  }

  async function renameFolder(id: string, current: string) {
    const name = prompt("Νέο όνομα φακέλου:", current)?.trim();
    if (!name || name === current) return;

    const res = await fetch(`/api/pdf-folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      alert("Αποτυχία μετονομασίας.");
      return;
    }
    await loadFolders();
  }

  async function deleteFolder(id: string) {
    if (!confirm("Διαγραφή φακέλου; (τα PDF δεν θα διαγραφούν, απλά θα βγουν από τον φάκελο)")) return;

    const res = await fetch(`/api/pdf-folders/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Αποτυχία διαγραφής φακέλου.");
      return;
    }

    setFiles((prev) => prev.map((f) => (f.pdfFolderId === id ? { ...f, pdfFolderId: null } : f)));
    setFolderFilter("ALL");
    await loadFolders();
  }

  async function movePdf(fileId: string, pdfFolderId: string | null) {
    const res = await fetch(`/api/files/${fileId}/pdf-folder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfFolderId }),
    });
    if (!res.ok) {
      alert("Αποτυχία μετακίνησης PDF.");
      return;
    }
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, pdfFolderId } : f)));
  }

  return (
    <div className="grid gap-4">
      {/* upload box */}
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">Προσθήκη αρχείου</h2>
        <p className="text-xs text-gray-500 mt-1">
          Το αρχείο θα συνδεθεί μόνο με τον λογαριασμό σας.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Τίτλος αρχείου"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />

          <input
            id="user-file-upload-input"
            type="file"
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white"
            onChange={(e) => {
              const pickedFile = e.currentTarget.files?.[0] ?? null;
              setNewFile(pickedFile);

              if (pickedFile) {
                setNewTitle(filenameWithoutExtension(pickedFile.name));
              }
            }}
          />

          <button
            type="button"
            disabled={uploading}
            onClick={uploadMyFile}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
          >
            <Upload size={16} />
            {uploading ? "Upload…" : "Προσθήκη"}
          </button>
        </div>
      </section>

      {/* toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Αναζήτηση αρχείων…"
          className="w-full sm:max-w-[520px] rounded-xl border px-3 py-2 text-sm"
        />
        <div className="shrink-0 text-sm text-gray-500">{filtered.length} αρχείο(α)</div>
      </div>

      {/* mobile: 1 column | desktop: 2 columns */}
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        {/* LEFT: OTHER FILES */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Αρχεία ({others.length})</h2>
          </div>

          {others.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Δεν βρέθηκαν αρχεία.</p>
          ) : (
            <>
              <div className="mt-3 grid gap-3 sm:hidden">
                {others.map((f) => {
                  const dt = new Date(f.createdAt);
                  return (
                    <div key={f.id} className="rounded-xl border p-3">
                      <div className="font-medium break-words">{f.title || f.originalName || "—"}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {dt.toLocaleDateString()} {dt.toLocaleTimeString()} · {formatSize(f.size)}
                      </div>
                      <div className="mt-3 flex gap-2">
                        {f.url ? (
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-black"
                            style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                          >
                            Λήψη
                          </a>
                        ) : (
                          <div className="text-sm text-gray-500">—</div>
                        )}

                        <button
                          type="button"
                          onClick={() => deleteFile(f.id)}
                          disabled={deletingId === f.id}
                          className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm disabled:opacity-60 hover:bg-black/5"
                          title="Διαγραφή"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 overflow-x-auto hidden sm:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr className="text-left">
                      <Th>Τίτλος</Th>
                      <Th>Μέγεθος</Th>
                      <Th className="text-right">Ενέργεια</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {others.map((f) => {
                      const dt = new Date(f.createdAt);
                      return (
                        <tr key={f.id} className="align-top">
                          <Td className="break-words">{f.title || "—"}</Td>
                          <Td className="whitespace-nowrap">{formatSize(f.size)}</Td>
                          <Td className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              {f.url ? (
                                <a
                                  href={f.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-block rounded-lg px-3 py-1 font-semibold text-black"
                                  style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                                >
                                  Λήψη
                                </a>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}

                              <button
                                type="button"
                                onClick={() => deleteFile(f.id)}
                                disabled={deletingId === f.id}
                                className="inline-flex items-center justify-center rounded-lg border px-3 py-1 text-sm disabled:opacity-60 hover:bg-black/5"
                                title="Διαγραφή"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* RIGHT: PDFS */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="font-semibold">PDF Αρχεία ({pdfs.length})</h2>

            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border px-2 py-2 text-sm w-full sm:w-auto"
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
              >
                <option value="ALL">Όλα</option>
                <option value="NONE">Χωρίς φάκελο</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={createFolder}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-60 shrink-0"
              >
                <Plus size={16} /> Φάκελος
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-xl border bg-gray-50 p-2 max-h-[220px] overflow-auto">
            {loadingFolders ? (
              <div className="text-sm text-gray-500 px-2 py-2">Φόρτωση φακέλων…</div>
            ) : folders.length === 0 ? (
              <div className="text-sm text-gray-500 px-2 py-2">Δεν υπάρχουν φάκελοι.</div>
            ) : (
              <div className="grid gap-1">
                <FolderRow active={folderFilter === "ALL"} name="Όλα" onClick={() => setFolderFilter("ALL")} />
                <FolderRow active={folderFilter === "NONE"} name="Χωρίς φάκελο" onClick={() => setFolderFilter("NONE")} />
                <div className="my-1 h-px bg-gray-200" />

                {folders.map((f) => (
                  <div
                    key={f.id}
                    className={[
                      "group flex items-center justify-between gap-2 rounded-lg px-2 py-2 cursor-pointer",
                      folderFilter === f.id ? "bg-white border" : "hover:bg-white/70",
                    ].join(" ")}
                    onClick={() => setFolderFilter(f.id)}
                    title={f.name}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <Folder size={16} className="shrink-0" />
                      <div className="truncate text-sm">{f.name}</div>
                    </div>

                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          renameFolder(f.id, f.name);
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
          </div>

          {pdfsFilteredByFolder.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Δεν βρέθηκαν αρχεία.</p>
          ) : (
            <div className="mt-4 grid gap-2">
              {pdfsFilteredByFolder.map((f) => {
                const dt = new Date(f.createdAt);
                return (
                  <div key={f.id} className="rounded-xl border p-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="shrink-0" />
                        <div className="font-medium break-words">{f.title || f.originalName || "PDF"}</div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {dt.toLocaleDateString()} {dt.toLocaleTimeString()} · {formatSize(f.size)}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:shrink-0">
                      <select
                        className="rounded-lg border px-2 py-2 text-sm sm:text-xs w-full sm:w-auto"
                        value={f.pdfFolderId ?? ""}
                        onChange={(e) => movePdf(f.id, e.target.value ? e.target.value : null)}
                      >
                        <option value="">(Χωρίς)</option>
                        {folders.map((fo) => (
                          <option key={fo.id} value={fo.id}>
                            {fo.name}
                          </option>
                        ))}
                      </select>

                      {f.url ? (
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          {/* Preview */}
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 w-full sm:w-auto"
                            title="Προβολή"
                          >
                            Προβολή
                          </a>

                          {/* Download */}
                          <a
                            href={`${f.url}?download=1`}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-black w-full sm:w-auto"
                            style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                          >
                            Λήψη
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}

                      <button
                        type="button"
                        onClick={() => deleteFile(f.id)}
                        disabled={deletingId === f.id}
                        className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg border px-3 py-2 text-sm disabled:opacity-60 hover:bg-black/5"
                        title="Διαγραφή"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FolderRow({ active, name, onClick }: { active: boolean; name: string; onClick: () => void }) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer",
        active ? "bg-white border" : "hover:bg-white/70",
      ].join(" ")}
      onClick={onClick}
    >
      <Folder size={16} className="shrink-0" />
      <span className="text-sm">{name}</span>
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