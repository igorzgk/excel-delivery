"use client";

import React from "react";

type UploadedFile = {
  id: string;
  title: string;
  originalName: string;
  url: string; // /api/files/download/<key> (redirects to signed URL)
  createdAt: string;
};

type Props = {
  onUploaded?: (f: UploadedFile) => void;
  buttonText?: string;
  accept?: string;
};

export default function UploadForm({ onUploaded, buttonText = "Upload", accept = ".xlsx,.xlsm,.xls" }: Props) {
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please choose a file first.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("File too large (max 50MB).");
      return;
    }

    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("file", file);
      if (title?.trim()) fd.append("title", title.trim());

      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.detail || json?.error || "Upload failed");
      }

      // json.file is the DB record we shaped in the API
      onUploaded?.(json.file);

      // reset
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err: any) {
      setError(err?.message || "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 rounded-2xl border border-gray-200 p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Excel file (.xlsx / .xlsm / .xls)</label>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0] ?? null;
            setFile(f || null);
            if (f && !title) setTitle(f.name.replace(/\.[A-Za-z0-9]+$/, ""));
          }}
          className="block w-full rounded-lg border border-gray-300 bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          placeholder="e.g. October Deliveries"
          className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setFile(null);
            setTitle("");
            if (inputRef.current) inputRef.current.value = "";
          }}
          disabled={busy}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm"
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={busy || !file}
          className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Uploading…" : buttonText}
        </button>
      </div>
    </form>
  );
}
