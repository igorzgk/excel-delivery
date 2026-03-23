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

  // ✅ DELETE FILE FUNCTION
  async function deleteFile(id: string) {
    if (!confirm("Θέλετε σίγουρα να διαγράψετε το αρχείο;")) return;

    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();

      // remove locally (instant UI update)
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      alert("Αποτυχία διαγραφής αρχείου.");
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

      if (!res.ok) throw new Error();

      setNewTitle("");
      setNewFile(null);

      const fileInput = document.getElementById("user-file-upload-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      await refreshFiles();
    } catch {
      alert("Αποτυχία upload");
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

      if (!res.ok) {
        alert("Αποτυχία δημιουργίας φακέλου.");
        return;
      }

      await loadFolders();
    } finally {
      setCreating(false);
    }
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
      {/* OTHER FILES */}
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">Αρχεία ({others.length})</h2>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Τίτλος</Th>
                <Th>Ημ/νία</Th>
                <Th>Μέγεθος</Th>
                <Th className="text-right">Ενέργειες</Th>
              </tr>
            </thead>
            <tbody>
              {others.map((f) => {
                const dt = new Date(f.createdAt);
                return (
                  <tr key={f.id}>
                    <Td>{f.title}</Td>
                    <Td>{dt.toLocaleDateString()}</Td>
                    <Td>{formatSize(f.size)}</Td>
                    <Td className="text-right space-x-2">
                      {f.url && (
                        <a href={f.url} target="_blank" className="px-2 py-1 bg-blue-200 rounded">
                          Λήψη
                        </a>
                      )}
                      <button
                        onClick={() => deleteFile(f.id)}
                        className="px-2 py-1 bg-red-100 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* PDFS */}
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">PDF ({pdfsFilteredByFolder.length})</h2>

        <div className="mt-3 grid gap-2">
          {pdfsFilteredByFolder.map((f) => {
            const dt = new Date(f.createdAt);
            return (
              <div key={f.id} className="border rounded p-3 flex justify-between items-center">
                <div>
                  <div>{f.title}</div>
                  <div className="text-xs text-gray-500">{dt.toLocaleDateString()}</div>
                </div>

                <div className="flex gap-2">
                  <select
                    value={f.pdfFolderId ?? ""}
                    onChange={(e) => movePdf(f.id, e.target.value || null)}
                    className="border rounded px-2"
                  >
                    <option value="">Χωρίς</option>
                    {folders.map((fo) => (
                      <option key={fo.id} value={fo.id}>
                        {fo.name}
                      </option>
                    ))}
                  </select>

                  {f.url && (
                    <a href={f.url} target="_blank" className="px-2 py-1 bg-blue-200 rounded">
                      Λήψη
                    </a>
                  )}

                  {/* ✅ DELETE BUTTON */}
                  <button
                    onClick={() => deleteFile(f.id)}
                    className="px-2 py-1 bg-red-100 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Th({ children, className = "" }: any) {
  return <th className={`px-3 py-2 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: any) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function formatSize(bytes?: number | null) {
  if (!bytes) return "—";
  return `${(bytes / 1024).toFixed(1)} KB`;
}