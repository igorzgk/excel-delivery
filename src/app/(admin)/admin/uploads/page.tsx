// src/app/(admin)/admin/uploads/page.tsx
"use client";
import { useState } from "react";

export default function AdminUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setStatus("Δεν επιλέχθηκε αρχείο.");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title || file.name);

    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) return setStatus(`❌ ${json.error}`);
    setStatus(`✅ Ανέβηκε: ${json.file.title}`);
    setFile(null);
    setTitle("");
  }

  return (
    <main className="grid gap-4 max-w-lg">
      <h1 className="text-xl font-semibold">Ανέβασμα αρχείου Excel</h1>
      <form onSubmit={handleUpload} className="grid gap-3">
        <input
          type="text"
          placeholder="Τίτλος (προαιρετικά)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={e => setFile(e.target.files?.[0] || null)}
          className="border rounded px-3 py-2"
        />
        <button className="rounded bg-[color:var(--brand)] text-black px-4 py-2">
          Ανέβασμα
        </button>
      </form>
      {status && <p className="text-sm">{status}</p>}
    </main>
  );
}
