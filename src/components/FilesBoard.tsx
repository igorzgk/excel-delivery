"use client";

import { useState } from "react";

export default function FilesBoard({ initialFiles }: { initialFiles: any[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(fileId: string) {
    if (!confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε το αρχείο;")) return;

    setDeletingId(fileId);
    setError(null);

    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });

      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(j?.error || "Αποτυχία διαγραφής");
      }

      // ✅ remove from UI
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err: any) {
      setError(err.message || "Αποτυχία διαγραφής");
    } finally {
      setDeletingId(null);
    }
  }

  if (!files.length) {
    return (
      <div className="text-sm text-gray-500">
        Δεν υπάρχουν αρχεία.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between border rounded-xl p-3"
          >
            <div>
              <p className="font-medium text-sm">{file.title}</p>
              <p className="text-xs text-gray-500">
                {file.originalName || file.mime || "Αρχείο"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {file.url && (
                <a
                  href={file.url}
                  target="_blank"
                  className="text-xs px-3 py-1 border rounded-lg"
                >
                  Προβολή
                </a>
              )}

              {/* ✅ DELETE BUTTON */}
              <button
                onClick={() => handleDelete(file.id)}
                disabled={deletingId === file.id}
                className="text-xs px-3 py-1 rounded-lg border text-red-600"
              >
                {deletingId === file.id ? "Διαγραφή…" : "Διαγραφή"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}