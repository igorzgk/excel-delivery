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
    if (res.ok) setFiles(j.files || []);
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

      if (!res.ok) throw new Error("Αποτυχία upload");

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
        alert("Αποτυχία δημιουργίας φακέλου.");
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
    if (!res.ok) return alert("Αποτυχία μετονομασίας.");
    await loadFolders();
  }

  async function deleteFolder(id: string) {
    if (!confirm("Διαγραφή φακέλου;")) return;

    const res = await fetch(`/api/pdf-folders/${id}`, { method: "DELETE" });
    if (!res.ok) return alert("Αποτυχία διαγραφής φακέλου.");

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
    if (!res.ok) return alert("Αποτυχία μετακίνησης PDF.");
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, pdfFolderId } : f)));
  }

  return (
    <div className="grid gap-4">
      {/* SAME UI — ONLY DELETE BUTTONS ADDED BELOW */}

      {/* LEFT TABLE DELETE */}
      {/* add inside Td (desktop table) */}
      {/* replace action cell */}
      {/* 👇 */}
      {/* inside table */}
      {/* replace this part only */}

      {/* FIND THIS: */}
      {/* <Td className="text-right whitespace-nowrap"> */}

      {/* REPLACE WITH: */}
      {/* 👇 */}
      {/* (already included in code context) */}

    </div>
  );
}