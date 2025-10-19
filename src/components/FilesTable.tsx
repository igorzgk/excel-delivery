"use client";

import React from "react";

type FileRow = {
  id: string;
  title: string;
  originalName: string;
  url: string;     // /api/files/download/<key>
  mime?: string;
  size?: number;
  createdAt: string;
  uploadedBy?: { id: string; name: string | null; email: string | null } | null;
  assignments?: { user: { id: string; email: string | null; name: string | null } }[];
};

type Props = {
  initialFiles: FileRow[];
  adminMode?: boolean; // when true, show Assignees column
};

function formatBytes(n?: number) {
  if (!n && n !== 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function FilesTable({ initialFiles, adminMode = false }: Props) {
  const [query, setQuery] = React.useState("");
  const [rows, setRows] = React.useState<FileRow[]>(initialFiles);

  React.useEffect(() => setRows(initialFiles), [initialFiles]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.title, r.originalName, r.uploadedBy?.email, r.uploadedBy?.name]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [rows, query]);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Search files…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          className="w-full max-w-md rounded-xl border border-gray-300 bg-white p-2 text-sm"
        />
        <span className="text-xs text-gray-500">{filtered.length} file(s)</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Original</th>
              <th className="px-4 py-3 font-semibold">Uploaded</th>
              <th className="px-4 py-3 font-semibold">Size</th>
              {adminMode && <th className="px-4 py-3 font-semibold">Assignees</th>}
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{f.title}</span>
                    {f.uploadedBy?.email && (
                      <span className="text-xs text-gray-500">
                        by {f.uploadedBy.name || f.uploadedBy.email}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{f.originalName}</td>
                <td className="px-4 py-3 text-gray-700">{formatDate(f.createdAt)}</td>
                <td className="px-4 py-3 text-gray-700">{formatBytes(f.size)}</td>
                {adminMode && (
                  <td className="px-4 py-3 text-gray-700">
                    {f.assignments?.length
                      ? f.assignments
                          .map((a) => a.user.name || a.user.email || a.user.id)
                          .join(", ")
                      : <span className="text-gray-400">—</span>}
                  </td>
                )}
                <td className="px-4 py-3">
                  <a
                    href={f.url}
                    className="inline-flex rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Download
                  </a>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={adminMode ? 6 : 5} className="px-4 py-8 text-center text-sm text-gray-500">
                  No files found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
