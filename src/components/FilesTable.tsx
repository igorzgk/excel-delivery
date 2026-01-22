"use client";

import { useEffect, useMemo, useState } from "react";

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

type PdfFolder = {
  id: string;
  name: string;
  ownerId: string | null;
};

type Labels = {
  search: string;
  countSuffix: string;
  title: string;
  uploaded: string;
  size: string;
  action: string;
  download: string;
  empty: string;
};

export default function FilesTable({
  initialFiles,
  labels,
}: {
  initialFiles: FileItem[];
  labels: Labels;
}) {
  const [query, setQuery] = useState("");
  const [files] = useState<FileItem[]>(initialFiles ?? []);

  // folders state
  const [folders, setFolders] = useState<PdfFolder[]>([]);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);

  const [selectedFolderId, setSelectedFolderId] = useState<string>("ALL");
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // fetch folders (safe)
  useEffect(() => {
    (async () => {
      setFolderLoading(true);
      setFoldersError(null);
      try {
        const res = await fetch("/api/pdf-folders", { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Αποτυχία φόρτωσης φακέλων");
        setFolders(j.folders || []);
      } catch (e: any) {
        setFoldersError(e?.message || "Αποτυχία φόρτωσης φακέλων");
        setFolders([]); // keep UI stable
      } finally {
        setFolderLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? files
      : files.filter((f) => {
          const title = (f.title || "").toLowerCase();
          const original = (f.originalName || "").toLowerCase();
          return title.includes(q) || original.includes(q);
        });
    return list;
  }, [files, query]);

  const isPdf = (f: FileItem) => {
    const m = (f.mime || "").toLowerCase();
    return m.includes("pdf") || (f.title || "").toLowerCase().endsWith(".pdf") || (f.originalName || "").toLowerCase().endsWith(".pdf");
  };

  const nonPdfFiles = useMemo(() => filtered.filter((f) => !isPdf(f)), [filtered]);
  const pdfFilesAll = useMemo(() => filtered.filter((f) => isPdf(f)), [filtered]);

  const pdfFiles = useMemo(() => {
    if (selectedFolderId === "ALL") return pdfFilesAll;
    if (selectedFolderId === "NONE") return pdfFilesAll.filter((f) => !f.pdfFolderId);
    return pdfFilesAll.filter((f) => f.pdfFolderId === selectedFolderId);
  }, [pdfFilesAll, selectedFolderId]);

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/pdf-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Αποτυχία δημιουργίας φακέλου");
      setFolders((prev) => [...prev, j.folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName("");
    } finally {
      setCreating(false);
    }
  }

  async function renameFolder(folderId: string) {
    const current = folders.find((f) => f.id === folderId);
    if (!current) return;
    const nextName = prompt("Νέο όνομα φακέλου:", current.name)?.trim();
    if (!nextName || nextName === current.name) return;

    const res = await fetch(`/api/pdf-folders/${folderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Αποτυχία μετονομασίας");
      return;
    }
    setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name: nextName } : f)));
  }

  async function deleteFolder(folderId: string) {
    const current = folders.find((f) => f.id === folderId);
    if (!current) return;
    const ok = confirm(`Διαγραφή φακέλου "${current.name}"; Τα PDF δεν θα διαγραφούν, απλά θα βγουν από τον φάκελο.`);
    if (!ok) return;

    const res = await fetch(`/api/pdf-folders/${folderId}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Αποτυχία διαγραφής");
      return;
    }
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (selectedFolderId === folderId) setSelectedFolderId("ALL");
  }

  async function movePdf(fileId: string, folderId: string | null) {
    const res = await fetch("/api/pdf-folders/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, folderId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(j?.error || "Αποτυχία μετακίνησης PDF");
      return;
    }
    // local update
    (files as any); // keep initial immutable, but we can optimistically update by copying:
    // simplest: reload page if you want perfect consistency
    window.location.reload();
  }

  return (
    <div className="grid gap-4">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          className="w-full max-w-[420px] rounded-xl border px-3 py-2 text-sm"
        />
        <div className="shrink-0 text-sm text-gray-500">
          {filtered.length} {labels.countSuffix}
        </div>
      </div>

      {/* two columns (like before) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT: NON-PDF */}
        <Panel
          title={`Αρχεία (${nonPdfFiles.length})`}
          empty={labels.empty}
        >
          <DesktopTable files={nonPdfFiles} labels={labels} />
          <MobileCards files={nonPdfFiles} labels={labels} />
        </Panel>

        {/* RIGHT: PDF */}
        <Panel
          title={`PDF Αρχεία (${pdfFiles.length})`}
          empty="Δεν βρέθηκαν αρχεία."
          right={
            <div className="flex items-center gap-2">
              <select
                className="rounded-xl border px-3 py-2 text-sm"
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
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
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() => {
                  const name = prompt("Όνομα φακέλου:")?.trim();
                  if (name) {
                    setNewFolderName(name);
                    // create immediately
                    setTimeout(createFolder, 0);
                  }
                }}
              >
                + Φάκελος
              </button>

              {/* folder actions only when a real folder selected */}
              {selectedFolderId !== "ALL" && selectedFolderId !== "NONE" && (
                <>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm"
                    onClick={() => renameFolder(selectedFolderId)}
                  >
                    Μετονομασία
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm"
                    onClick={() => deleteFolder(selectedFolderId)}
                  >
                    Διαγραφή
                  </button>
                </>
              )}
            </div>
          }
          subtitle={
            foldersError
              ? <span className="text-xs text-red-600">{foldersError}</span>
              : folderLoading
              ? <span className="text-xs text-gray-500">Φόρτωση φακέλων…</span>
              : folders.length === 0
              ? <span className="text-xs text-gray-500">Δεν υπάρχουν φάκελοι.</span>
              : null
          }
        >
          <PdfDesktopTable
            files={pdfFiles}
            labels={labels}
            folders={folders}
            selectedFolderId={selectedFolderId}
            onMove={movePdf}
          />
          <PdfMobileCards
            files={pdfFiles}
            labels={labels}
            folders={folders}
            selectedFolderId={selectedFolderId}
            onMove={movePdf}
          />
        </Panel>
      </div>

      {/* hidden input state used by createFolder() when prompt */}
      <input
        className="hidden"
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
        disabled={creating}
      />
    </div>
  );
}

function Panel({
  title,
  right,
  subtitle,
  empty,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  subtitle?: React.ReactNode;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{title}</div>
          {subtitle ? <div className="mt-1">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

/* ---------- NON-PDF renderers (same idea as yours) ---------- */

function MobileCards({ files, labels }: { files: FileItem[]; labels: Labels }) {
  if (files.length === 0) return <div className="text-sm text-gray-500 sm:hidden">{labels.empty}</div>;
  return (
    <div className="grid gap-3 sm:hidden">
      {files.map((f) => {
        const dt = new Date(f.createdAt);
        return (
          <div key={f.id} className="rounded-2xl border bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium break-words">{f.title}</div>
                <div className="text-xs text-gray-600">
                  {labels.uploaded}: {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
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
                  {labels.download}
                </a>
              ) : null}
            </div>
            <div className="mt-3 text-sm">
              <div className="text-gray-600">{labels.size}</div>
              <div>{formatSize(f.size)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DesktopTable({ files, labels }: { files: FileItem[]; labels: Labels }) {
  if (files.length === 0) return <div className="text-sm text-gray-500 hidden sm:block">{labels.empty}</div>;

  return (
    <div className="hidden sm:block">
      <table className="w-full text-sm">
        <colgroup>
          <col className="w-[58%]" />
          <col className="w-[22%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="bg-gray-50 text-gray-700">
          <tr className="text-left">
            <Th>{labels.title}</Th>
            <Th>{labels.uploaded}</Th>
            <Th>{labels.size}</Th>
            <Th className="text-right">{labels.action}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {files.map((f) => {
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
                      {labels.download}
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
  );
}

/* ---------- PDF renderers (with move-to-folder) ---------- */

function PdfDesktopTable({
  files,
  labels,
  folders,
  selectedFolderId,
  onMove,
}: {
  files: FileItem[];
  labels: Labels;
  folders: PdfFolder[];
  selectedFolderId: string;
  onMove: (fileId: string, folderId: string | null) => void;
}) {
  if (files.length === 0) return <div className="text-sm text-gray-500 hidden sm:block">Δεν βρέθηκαν αρχεία.</div>;

  return (
    <div className="hidden sm:block">
      <table className="w-full text-sm">
        <colgroup>
          <col className="w-[55%]" />
          <col className="w-[25%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="bg-gray-50 text-gray-700">
          <tr className="text-left">
            <Th>{labels.title}</Th>
            <Th>Φάκελος</Th>
            <Th>{labels.size}</Th>
            <Th className="text-right">{labels.action}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {files.map((f) => (
            <tr key={f.id} className="align-top">
              <Td className="break-words">{f.title}</Td>
              <Td>
                <select
                  className="rounded-lg border px-2 py-1 text-sm"
                  value={f.pdfFolderId || ""}
                  onChange={(e) => onMove(f.id, e.target.value ? e.target.value : null)}
                >
                  <option value="">—</option>
                  {folders.map((fo) => (
                    <option key={fo.id} value={fo.id}>
                      {fo.name}
                    </option>
                  ))}
                </select>
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
                    {labels.download}
                  </a>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedFolderId !== "ALL" && selectedFolderId !== "NONE" ? (
        <div className="mt-2 text-xs text-gray-500">Εμφάνιση PDF μέσα στον επιλεγμένο φάκελο.</div>
      ) : null}
    </div>
  );
}

function PdfMobileCards({
  files,
  labels,
  folders,
  onMove,
}: {
  files: FileItem[];
  labels: Labels;
  folders: PdfFolder[];
  selectedFolderId: string;
  onMove: (fileId: string, folderId: string | null) => void;
}) {
  if (files.length === 0) return <div className="text-sm text-gray-500 sm:hidden">Δεν βρέθηκαν αρχεία.</div>;
  return (
    <div className="grid gap-3 sm:hidden">
      {files.map((f) => (
        <div key={f.id} className="rounded-2xl border bg-white p-3 shadow-sm">
          <div className="font-medium break-words">{f.title}</div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <select
              className="w-full rounded-lg border px-2 py-2 text-sm"
              value={f.pdfFolderId || ""}
              onChange={(e) => onMove(f.id, e.target.value ? e.target.value : null)}
            >
              <option value="">— Φάκελος —</option>
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
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-black"
                style={{ backgroundColor: "var(--brand, #25C3F4)" }}
              >
                {labels.download}
              </a>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {labels.size}: {formatSize(f.size)}
          </div>
        </div>
      ))}
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
