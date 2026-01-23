"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Folder, FolderOpen, Pencil, Trash2, Plus, FileText } from "lucide-react";

type FolderItem = {
  id: string;
  name: string;
  createdAt: string;
  ownerId: string;
};

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

function isPdfFile(f: FileItem) {
  const mime = (f.mime || "").toLowerCase();
  if (mime.includes("pdf")) return true;
  const name = (f.originalName || f.title || "").toLowerCase();
  return name.endsWith(".pdf");
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

export default function PdfPanel({
  files,
  title = "PDF Αρχεία",
}: {
  files: FileItem[];
  title?: string;
}) {
  const pdfFiles = useMemo(() => files.filter(isPdfFile), [files]);

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [folderError, setFolderError] = useState<string | null>(null);

  // selected folder filter
  const [selectedFolderId, setSelectedFolderId] = useState<string>("ALL"); // ALL | folderId

  async function loadFolders() {
    setLoadingFolders(true);
    setFolderError(null);
    try {
      const res = await fetch("/api/pdf-folders", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Αποτυχία φόρτωσης φακέλων");
      setFolders(j.folders || []);
    } catch (e: any) {
      setFolderError(e?.message || "Αποτυχία φόρτωσης φακέλων");
    } finally {
      setLoadingFolders(false);
    }
  }

  useEffect(() => {
    loadFolders();
  }, []);

  const visiblePdfFiles = useMemo(() => {
    if (selectedFolderId === "ALL") return pdfFiles;
    return pdfFiles.filter((f) => (f.pdfFolderId || null) === selectedFolderId);
  }, [pdfFiles, selectedFolderId]);

  async function createFolder() {
    const name = (prompt("Όνομα φακέλου:") || "").trim();
    if (!name) return;

    const res = await fetch("/api/pdf-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error === "folder_exists" ? "Υπάρχει ήδη φάκελος με αυτό το όνομα." : (j?.error || "Αποτυχία δημιουργίας"));
      return;
    }
    await loadFolders();
  }

  async function renameFolder(folder: FolderItem) {
    const name = (prompt("Νέο όνομα φακέλου:", folder.name) || "").trim();
    if (!name || name === folder.name) return;

    const res = await fetch("/api/pdf-folders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: folder.id, name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Αποτυχία μετονομασίας");
      return;
    }
    await loadFolders();
  }

  async function deleteFolder(folder: FolderItem) {
    const ok = confirm(`Διαγραφή φακέλου "${folder.name}";\n(Τα PDF μέσα θα μείνουν χωρίς φάκελο.)`);
    if (!ok) return;

    const res = await fetch("/api/pdf-folders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: folder.id }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Αποτυχία διαγραφής");
      return;
    }

    if (selectedFolderId === folder.id) setSelectedFolderId("ALL");
    await loadFolders();
  }

  return (
    <section className="rounded-2xl border bg-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            {title} ({visiblePdfFiles.length})
          </div>
          <div className="text-xs text-gray-500">
            {selectedFolderId === "ALL" ? "Όλα τα PDF" : "PDF του επιλεγμένου φακέλου"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border px-2 py-1 text-sm"
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
          >
            <option value="ALL">Όλα</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={createFolder}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-sm"
          >
            <Plus size={16} />
            Φάκελος
          </button>
        </div>
      </div>

      {/* Folders list rows */}
      <div className="mt-4">
        <div className="text-xs font-semibold text-gray-600 mb-2">Φάκελοι</div>

        {loadingFolders ? (
          <div className="text-sm text-gray-500">Φόρτωση φακέλων…</div>
        ) : folderError ? (
          <div className="text-sm text-red-600">{folderError}</div>
        ) : folders.length === 0 ? (
          <div className="text-sm text-gray-500">Δεν υπάρχουν φάκελοι.</div>
        ) : (
          <div className="grid gap-2">
            {folders.map((f) => {
              const selected = selectedFolderId === f.id;
              return (
                <div
                  key={f.id}
                  className={[
                    "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                    selected ? "bg-gray-50 border-gray-300" : "hover:bg-gray-50",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId(selected ? "ALL" : f.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {selected ? <FolderOpen size={18} /> : <Folder size={18} />}
                    <span className="truncate text-sm font-medium">{f.name}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => renameFolder(f)}
                      className="rounded-lg p-2 hover:bg-gray-100"
                      aria-label="Μετονομασία"
                      title="Μετονομασία"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFolder(f)}
                      className="rounded-lg p-2 hover:bg-gray-100"
                      aria-label="Διαγραφή"
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
      </div>

      {/* PDF files list */}
      <div className="mt-5">
        <div className="text-xs font-semibold text-gray-600 mb-2">PDF Αρχεία</div>

        {visiblePdfFiles.length === 0 ? (
          <div className="text-sm text-gray-500">Δεν βρέθηκαν αρχεία.</div>
        ) : (
          <div className="grid gap-2">
            {visiblePdfFiles.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl border p-2">
                <div className="min-w-0 flex items-center gap-2">
                  <FileText size={18} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {f.title || f.originalName || "PDF"}
                    </div>
                    <div className="text-xs text-gray-500">{formatSize(f.size)}</div>
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
                    Άνοιγμα
                  </a>
                ) : (
                  <span className="text-xs text-gray-500">—</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
