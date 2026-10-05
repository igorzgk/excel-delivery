"use client";

import React, { useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
} from "lucide-react";

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

function isExcelFile(file: FileItem) {
  const name = (
    file.originalName ||
    file.title ||
    ""
  ).toLowerCase();

  const mime = (file.mime || "").toLowerCase();

  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  );
}

function filenameWithoutExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

function cleanUploadedFilename(name: string) {
  const withoutExtension = filenameWithoutExtension(name);

  return withoutExtension.replace(
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}__?/i,
    ""
  );
}

export default function ExcelFilesBoard({
  initialFiles,
}: {
  initialFiles: FileItem[];
}) {
  const [files, setFiles] = useState<FileItem[]>(
    (initialFiles ?? []).filter(isExcelFile)
  );

  const [query, setQuery] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return files;

    return files.filter((file) => {
      const title = (file.title || "").toLowerCase();
      const originalName = (
        file.originalName || ""
      ).toLowerCase();

      return (
        title.includes(q) ||
        originalName.includes(q)
      );
    });
  }, [files, query]);

  async function refreshFiles() {
    const res = await fetch("/api/files", {
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      setFiles(
        (json.files || []).filter(isExcelFile)
      );
    }
  }

  async function uploadMyFile() {
    if (!newFile || !newTitle.trim()) {
      alert(
        "Συμπληρώστε τίτλο και επιλέξτε αρχείο Excel."
      );
      return;
    }

    if (
      !newFile.name.toLowerCase().endsWith(".xlsx") &&
      !newFile.name.toLowerCase().endsWith(".xls")
    ) {
      alert(
        "Σε αυτή τη σελίδα επιτρέπονται μόνο αρχεία Excel."
      );
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

      const text = await res.text().catch(() => "");

      if (!res.ok) {
        throw new Error(
          text || "Αποτυχία upload"
        );
      }

      setNewTitle("");
      setNewFile(null);

      const input = document.getElementById(
        "excel-file-upload-input"
      ) as HTMLInputElement | null;

      if (input) input.value = "";

      await refreshFiles();
    } catch (error: any) {
      alert(
        error?.message || "Αποτυχία upload"
      );
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(fileId: string) {
    if (!confirm("Διαγραφή αρχείου;")) return;

    setDeletingId(fileId);

    try {
      const res = await fetch(
        `/api/files/${fileId}`,
        {
          method: "DELETE",
        }
      );

      const json = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          json?.error || "Αποτυχία διαγραφής"
        );
      }

      setFiles((previous) =>
        previous.filter(
          (file) => file.id !== fileId
        )
      );
    } catch (error: any) {
      alert(
        error?.message ||
          "Αποτυχία διαγραφής"
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">
          Προσθήκη αρχείου Excel
        </h2>

        <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Τίτλος αρχείου"
            value={newTitle}
            onChange={(e) =>
              setNewTitle(e.target.value)
            }
          />

          <input
            id="excel-file-upload-input"
            type="file"
            accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            onChange={(e) => {
              const picked =
                e.currentTarget.files?.[0] ??
                null;

              setNewFile(picked);

              if (picked) {
                setNewTitle(
                  cleanUploadedFilename(
                    picked.name
                  )
                );
              }
            }}
          />

          <button
            type="button"
            disabled={uploading}
            onClick={uploadMyFile}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{
              backgroundColor:
                "var(--brand,#25C3F4)",
              color: "#061630",
            }}
          >
            <Upload size={17} />

            {uploading
              ? "Upload…"
              : "Προσθήκη"}
          </button>
        </div>
      </section>

      {/* Explorer toolbar */}
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="flex flex-col gap-3 border-b bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(e) =>
              setQuery(e.target.value)
            }
            placeholder="Αναζήτηση αρχείων..."
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm sm:max-w-[440px]"
          />

          <div className="text-sm text-gray-500">
            {filtered.length} αρχείο(α)
          </div>
        </div>

        {/* Windows-like icon view */}
        <div className="min-h-[420px] p-5">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Δεν βρέθηκαν αρχεία Excel.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3">
              {filtered.map((file) => {
                const title =
                  file.title ||
                  file.originalName ||
                  "Excel";

                return (
                  <div
                    key={file.id}
                    className="group relative flex min-h-[155px] flex-col items-center rounded-lg border border-transparent p-3 text-center transition hover:border-blue-200 hover:bg-blue-50/70"
                  >
                    {file.url ? (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-1 flex-col items-center"
                        title={title}
                      >
                        <div className="flex h-20 items-center justify-center">
                          <FileSpreadsheet
                            size={64}
                            strokeWidth={1.4}
                            className="text-emerald-600"
                          />
                        </div>

                        <div className="mt-1 line-clamp-3 break-words text-sm font-medium text-gray-800">
                          {title}
                        </div>
                      </a>
                    ) : (
                      <>
                        <div className="flex h-20 items-center justify-center">
                          <FileSpreadsheet
                            size={64}
                            strokeWidth={1.4}
                            className="text-emerald-600"
                          />
                        </div>

                        <div className="mt-1 line-clamp-3 break-words text-sm font-medium">
                          {title}
                        </div>
                      </>
                    )}

                    <div className="mt-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      {file.url && (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          title="Λήψη"
                          className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
                        >
                          <Download size={15} />
                        </a>
                      )}

                      <button
                        type="button"
                        title="Διαγραφή"
                        disabled={
                          deletingId === file.id
                        }
                        onClick={() =>
                          deleteFile(file.id)
                        }
                        className="rounded-md border bg-white p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}