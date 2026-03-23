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

export default function FilesBoard({ initialFiles }: { initialFiles: FileItem[] }) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileItem[]>(initialFiles ?? []);

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("ALL");
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  async function deleteFile(id: string) {
    if (!confirm("Σίγουρα θέλετε να διαγράψετε το αρχείο;")) return;

    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Αποτυχία διαγραφής.");
      return;
    }

    setFiles((prev) => prev.filter((f) => f.id !== id));
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
            onChange={(e) => setNewFile(e.currentTarget.files?.[0] ?? null)}
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

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        {/* LEFT */}
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Αρχεία ({others.length})</h2>

          <div className="mt-3 grid gap-3 sm:hidden">
            {others.map((f) => {
              const dt = new Date(f.createdAt);
              return (
                <div key={f.id} className="rounded-xl border p-3">
                  <div className="font-medium">{f.title}</div>
                  <div className="text-xs text-gray-600">{formatSize(f.size)}</div>
                  <div className="flex gap-2 mt-2">
                    <a href={f.url || "#"}>Λήψη</a>
                    <button onClick={() => deleteFile(f.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <table className="w-full mt-3 text-sm hidden sm:block">
            <tbody>
              {others.map((f) => (
                <tr key={f.id}>
                  <td>{f.title}</td>
                  <td className="text-right">
                    <button onClick={() => deleteFile(f.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* RIGHT */}
        <section className="rounded-2xl border bg-white p-4">
          {pdfsFilteredByFolder.map((f) => (
            <div key={f.id} className="flex justify-between">
              <div>{f.title}</div>
              <button onClick={() => deleteFile(f.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return "—";
  return bytes + "B";
}