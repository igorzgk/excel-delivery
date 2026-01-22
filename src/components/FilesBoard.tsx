"use client";

import { useMemo, useState } from "react";

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

type Folder = { id: string; name: string };

export default function FilesBoard({ initialFiles }: { initialFiles: FileItem[] }) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileItem[]>(initialFiles ?? []);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("ALL"); // ALL | NONE | folderId
  const [loadingFolders, setLoadingFolders] = useState(false);

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
    const isPdf = (f: FileItem) =>
      (f.mime || "").toLowerCase().includes("pdf") ||
      (f.originalName || "").toLowerCase().endsWith(".pdf") ||
      (f.title || "").toLowerCase().endsWith(".pdf");

    const p = filtered.filter(isPdf);
    const o = filtered.filter((x) => !isPdf(x));
    return { pdfs: p, others: o };
  }, [filtered]);

  const pdfsFilteredByFolder = useMemo(() => {
    if (folderFilter === "ALL") return pdfs;
    if (folderFilter === "NONE") return pdfs.filter((p) => !p.pdfFolderId);
    return pdfs.filter((p) => p.pdfFolderId === folderFilter);
  }, [pdfs, folderFilter]);

  async function loadFolders() {
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/pdf-folders", { cache: "no-store" });
      const j = await res.json();
      if (res.ok) setFolders(j.folders || []);
    } finally {
      setLoadingFolders(false);
    }
  }

  async function createFolder() {
    const name = prompt("Όνομα φακέλου (PDF):")?.trim();
    if (!name) return;
    const res = await fetch("/api/pdf-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      alert("Αποτυχία δημιουργίας φακέλου (ίσως υπάρχει ήδη).");
      return;
    }
    await loadFolders();
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
    setFolderFilter("ALL");
    // detach happens server-side; just refresh locally by removing folder id from affected files if you want:
    setFiles((prev) => prev.map((f) => (f.pdfFolderId === id ? { ...f, pdfFolderId: null } : f)));
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

  // load folders once (lazy) when user focuses pdf panel
  const ensureFolders = async () => {
    if (folders.length) return;
    await loadFolders();
  };

  return (
    <div className="grid gap-4">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Αναζήτηση αρχείων…"
          className="w-full max-w-[520px] rounded-xl border px-3 py-2 text-sm"
        />
        <div className="shrink-0 text-sm text-gray-500">{filtered.length} αρχείο(α)</div>
      </div>

      {/* 2 columns on desktop, stacked on mobile */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT: other files */}
        <section className="rounded-2xl border bg-white p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Αρχεία ({others.length})</h2>
          </div>

          {others.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Δεν βρέθηκαν αρχεία.</p>
          ) : (
            <div className="mt-3 overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[52%]" />
                  <col className="w-[24%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead className="bg-gray-50 text-gray-700">
                  <tr className="text-left">
                    <Th>Τίτλος</Th>
                    <Th>Ανέβηκε</Th>
                    <Th>Μέγεθος</Th>
                    <Th className="text-right">Ενέργεια</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {others.map((f) => {
                    const dt = new Date(f.createdAt);
                    return (
                      <tr key={f.id} className="align-top">
                        <Td className="break-words">{f.title}</Td>
                        <Td className="whitespace-nowrap">
                          {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                        </Td>
                        <Td className="whitespace-nowrap">{formatSize(f.size)}</Td>
                        <Td className="text-right whitespace-nowrap">
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
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* RIGHT: PDFs with folders */}
        <section className="rounded-2xl border bg-white p-4" onMouseEnter={ensureFolders} onFocus={ensureFolders}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">PDF Αρχεία ({pdfs.length})</h2>

            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border px-2 py-1 text-sm"
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                onClick={ensureFolders}
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
                className="rounded-lg border px-3 py-1 text-sm"
                title="Δημιουργία φακέλου"
              >
                + Φάκελος
              </button>
            </div>
          </div>

          {/* folders list */}
          <div className="mt-3 flex flex-wrap gap-2">
            {loadingFolders ? (
              <span className="text-xs text-gray-500">Φόρτωση φακέλων…</span>
            ) : folders.length === 0 ? (
              <span className="text-xs text-gray-500">Δεν υπάρχουν φάκελοι.</span>
            ) : (
              folders.map((f) => (
                <div key={f.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setFolderFilter(f.id)}
                    title="Φίλτρο"
                  >
                    {f.name}
                  </button>
                  <button type="button" onClick={() => renameFolder(f.id, f.name)} title="Μετονομασία">
                    ✎
                  </button>
                  <button type="button" onClick={() => deleteFolder(f.id)} title="Διαγραφή">
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {pdfsFilteredByFolder.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Δεν βρέθηκαν αρχεία.</p>
          ) : (
            <div className="mt-4 overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[46%]" />
                  <col className="w-[22%]" />
                  <col className="w-[10%]" />
                  <col className="w-[22%]" />
                </colgroup>
                <thead className="bg-gray-50 text-gray-700">
                  <tr className="text-left">
                    <Th>Τίτλος</Th>
                    <Th>Ανέβηκε</Th>
                    <Th>Μέγεθος</Th>
                    <Th className="text-right">Φάκελος / Λήψη</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pdfsFilteredByFolder.map((f) => {
                    const dt = new Date(f.createdAt);
                    return (
                      <tr key={f.id} className="align-top">
                        <Td className="break-words">{f.title}</Td>
                        <Td className="whitespace-nowrap">
                          {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                        </Td>
                        <Td className="whitespace-nowrap">{formatSize(f.size)}</Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              className="rounded-lg border px-2 py-1 text-xs"
                              value={f.pdfFolderId ?? ""}
                              onChange={(e) => movePdf(f.id, e.target.value ? e.target.value : null)}
                              onClick={ensureFolders}
                              title="Μετακίνηση σε φάκελο"
                            >
                              <option value="">(Χωρίς)</option>
                              {folders.map((fo) => (
                                <option key={fo.id} value={fo.id}>
                                  {fo.name}
                                </option>
                              ))}
                            </select>

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
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
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
