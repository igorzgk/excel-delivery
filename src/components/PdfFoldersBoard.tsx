"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  Pencil,
  Plus,
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

type FolderItem = {
  id: string;
  name: string;
};

function isPdfFile(file: FileItem) {
  const mime = (file.mime || "").toLowerCase();

  const name = (
    file.originalName ||
    file.title ||
    ""
  ).toLowerCase();

  return (
    mime.includes("pdf") ||
    name.endsWith(".pdf")
  );
}

function filenameWithoutExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

function cleanUploadedFilename(name: string) {
  const withoutExtension =
    filenameWithoutExtension(name);

  return withoutExtension.replace(
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}__?/i,
    ""
  );
}

export default function PdfFoldersBoard({
  initialFiles,
}: {
  initialFiles: FileItem[];
}) {
  const [files, setFiles] = useState<FileItem[]>(
    (initialFiles ?? []).filter(isPdfFile)
  );

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loadingFolders, setLoadingFolders] =
    useState(true);

  const [currentFolderId, setCurrentFolderId] =
    useState<string | null>(null);

  const [query, setQuery] = useState("");

  // Upload
  const [newTitle, setNewTitle] = useState("");
  const [newFile, setNewFile] =
    useState<File | null>(null);
  const [uploading, setUploading] =
    useState(false);

  // Folder state
  const [creatingFolder, setCreatingFolder] =
    useState(false);

  // Delete state
  const [deletingFileId, setDeletingFileId] =
    useState<string | null>(null);

  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;

    return (
      folders.find(
        (folder) =>
          folder.id === currentFolderId
      ) || null
    );
  }, [folders, currentFolderId]);

  const rootFiles = useMemo(() => {
    return files.filter(
      (file) => !file.pdfFolderId
    );
  }, [files]);

  const currentFolderFiles = useMemo(() => {
    if (!currentFolderId) {
      return rootFiles;
    }

    return files.filter(
      (file) =>
        file.pdfFolderId === currentFolderId
    );
  }, [files, rootFiles, currentFolderId]);

  const visibleFolders = useMemo(() => {
    if (currentFolderId) return [];

    const q = query.trim().toLowerCase();

    if (!q) return folders;

    return folders.filter((folder) =>
      folder.name.toLowerCase().includes(q)
    );
  }, [folders, query, currentFolderId]);

  const visibleFiles = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return currentFolderFiles;

    return currentFolderFiles.filter(
      (file) => {
        const title = (
          file.title || ""
        ).toLowerCase();

        const originalName = (
          file.originalName || ""
        ).toLowerCase();

        return (
          title.includes(q) ||
          originalName.includes(q)
        );
      }
    );
  }, [currentFolderFiles, query]);

  async function loadFolders() {
    setLoadingFolders(true);

    try {
      const res = await fetch(
        "/api/pdf-folders",
        {
          cache: "no-store",
        }
      );

      const json = await res
        .json()
        .catch(() => ({}));

      if (res.ok) {
        setFolders(json.folders || []);
      }
    } finally {
      setLoadingFolders(false);
    }
  }

  async function refreshFiles() {
    const res = await fetch("/api/files", {
      cache: "no-store",
    });

    const json = await res
      .json()
      .catch(() => ({}));

    if (res.ok) {
      setFiles(
        (json.files || []).filter(isPdfFile)
      );
    }
  }

  useEffect(() => {
    loadFolders();
  }, []);

  async function uploadPdf() {
    if (!newFile || !newTitle.trim()) {
      alert(
        "Συμπληρώστε τίτλο και επιλέξτε αρχείο PDF."
      );
      return;
    }

    const isPdf =
      newFile.name
        .toLowerCase()
        .endsWith(".pdf") ||
      newFile.type === "application/pdf";

    if (!isPdf) {
      alert(
        "Σε αυτή τη σελίδα επιτρέπονται μόνο αρχεία PDF."
      );
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append(
        "title",
        newTitle.trim()
      );

      formData.append("file", newFile);

      const response = await fetch(
        "/api/files",
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία upload"
        );
      }

      /*
       * If the user is currently inside a folder,
       * automatically place the new PDF in that folder.
       */
      const createdFileId =
        json?.file?.id || json?.id;

      if (
        currentFolderId &&
        createdFileId
      ) {
        const moveResponse = await fetch(
          `/api/files/${createdFileId}/pdf-folder`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              pdfFolderId:
                currentFolderId,
            }),
          }
        );

        if (!moveResponse.ok) {
          console.error(
            "PDF uploaded but could not be moved into folder."
          );
        }
      }

      setNewTitle("");
      setNewFile(null);

      const input =
        document.getElementById(
          "pdf-file-upload-input"
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await refreshFiles();
    } catch (error: any) {
      alert(
        error?.message ||
          "Αποτυχία upload"
      );
    } finally {
      setUploading(false);
    }
  }

  async function createFolder() {
    const name = prompt(
      "Όνομα νέου φακέλου:"
    )?.trim();

    if (!name) return;

    setCreatingFolder(true);

    try {
      const res = await fetch(
        "/api/pdf-folders",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name,
          }),
        }
      );

      const json = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        if (
          json?.error ===
          "folder_exists"
        ) {
          alert(
            "Υπάρχει ήδη φάκελος με αυτό το όνομα."
          );
        } else {
          alert(
            "Αποτυχία δημιουργίας φακέλου."
          );
        }

        return;
      }

      await loadFolders();
    } finally {
      setCreatingFolder(false);
    }
  }

  async function renameFolder(
    folderId: string,
    currentName: string
  ) {
    const name = prompt(
      "Νέο όνομα φακέλου:",
      currentName
    )?.trim();

    if (!name || name === currentName) {
      return;
    }

    const res = await fetch(
      `/api/pdf-folders/${folderId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          name,
        }),
      }
    );

    if (!res.ok) {
      alert(
        "Αποτυχία μετονομασίας φακέλου."
      );
      return;
    }

    await loadFolders();
  }

  async function deleteFolder(
    folderId: string
  ) {
    const folder = folders.find(
      (item) => item.id === folderId
    );

    if (
      !confirm(
        `Διαγραφή φακέλου${
          folder ? ` "${folder.name}"` : ""
        };\n\nΤα PDF μέσα στον φάκελο δεν θα διαγραφούν. Θα μεταφερθούν στην αρχική προβολή.`
      )
    ) {
      return;
    }

    const res = await fetch(
      `/api/pdf-folders/${folderId}`,
      {
        method: "DELETE",
      }
    );

    if (!res.ok) {
      alert(
        "Αποτυχία διαγραφής φακέλου."
      );
      return;
    }

    setFiles((previous) =>
      previous.map((file) =>
        file.pdfFolderId === folderId
          ? {
              ...file,
              pdfFolderId: null,
            }
          : file
      )
    );

    if (
      currentFolderId === folderId
    ) {
      setCurrentFolderId(null);
    }

    await loadFolders();
  }

  async function movePdf(
    fileId: string,
    folderId: string | null
  ) {
    const res = await fetch(
      `/api/files/${fileId}/pdf-folder`,
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          pdfFolderId: folderId,
        }),
      }
    );

    if (!res.ok) {
      alert(
        "Αποτυχία μετακίνησης PDF."
      );
      return;
    }

    setFiles((previous) =>
      previous.map((file) =>
        file.id === fileId
          ? {
              ...file,
              pdfFolderId:
                folderId,
            }
          : file
      )
    );
  }

  async function deleteFile(
    fileId: string
  ) {
    if (
      !confirm(
        "Διαγραφή αρχείου PDF;"
      )
    ) {
      return;
    }

    setDeletingFileId(fileId);

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
          json?.error ||
            "Αποτυχία διαγραφής"
        );
      }

      setFiles((previous) =>
        previous.filter(
          (file) =>
            file.id !== fileId
        )
      );
    } catch (error: any) {
      alert(
        error?.message ||
          "Αποτυχία διαγραφής"
      );
    } finally {
      setDeletingFileId(null);
    }
  }

  function openFolder(
    folderId: string
  ) {
    setCurrentFolderId(folderId);
    setQuery("");
  }

  function goToRoot() {
    setCurrentFolderId(null);
    setQuery("");
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <section className="rounded-xl border bg-white p-3 sm:p-4">
        <div>
          <h2 className="font-semibold">
            Προσθήκη PDF
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            {currentFolder
              ? `Το αρχείο θα προστεθεί στον φάκελο "${currentFolder.name}".`
              : "Το αρχείο θα προστεθεί στα υπόλοιπα αρχεία τεκμηρίωσης."}
          </p>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
          <input
            className="w-full min-w-0 rounded-lg border px-3 py-2 text-sm"
            placeholder="Τίτλος αρχείου"
            value={newTitle}
            onChange={(event) =>
              setNewTitle(
                event.target.value
              )
            }
          />

          <input
            id="pdf-file-upload-input"
            type="file"
            accept=".pdf,application/pdf"
            className="w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm"
            onChange={(event) => {
              const pickedFile =
                event.currentTarget
                  .files?.[0] ??
                null;

              setNewFile(pickedFile);

              if (pickedFile) {
                setNewTitle(
                  cleanUploadedFilename(
                    pickedFile.name
                  )
                );
              }
            }}
          />

          <button
            type="button"
            disabled={uploading}
            onClick={uploadPdf}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 md:w-auto"
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

      {/* Explorer */}
      <section className="overflow-hidden rounded-xl border bg-white">
        {/* Explorer top bar */}
        <div className="border-b bg-gray-50">
          {/* Breadcrumb */}
          <div className="flex min-h-[50px] items-center gap-2 border-b px-3 py-2 sm:px-4">
            {currentFolder ? (
              <button
                type="button"
                onClick={goToRoot}
                className="flex shrink-0 items-center justify-center rounded-md border bg-white p-2 hover:bg-gray-100"
                title="Πίσω"
              >
                <ArrowLeft
                  size={17}
                />
              </button>
            ) : null}

            <div className="flex min-w-0 items-center gap-2 text-sm">
              <button
                type="button"
                onClick={goToRoot}
                className={[
                  "truncate",
                  currentFolder
                    ? "text-gray-500 hover:text-gray-900"
                    : "font-medium text-gray-900",
                ].join(" ")}
              >
                Υπόλοιπα αρχεία
                τεκμηρίωσης
              </button>

              {currentFolder && (
                <>
                  <span className="text-gray-400">
                    ›
                  </span>

                  <span className="truncate font-medium">
                    {
                      currentFolder.name
                    }
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Search / folder button */}
          <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value
                )
              }
              placeholder={
                currentFolder
                  ? "Αναζήτηση στον φάκελο..."
                  : "Αναζήτηση φακέλων και PDF..."
              }
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm sm:max-w-[440px]"
            />

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="text-sm text-gray-500">
                {currentFolder
                  ? `${visibleFiles.length} αρχείο(α)`
                  : `${
                      visibleFolders.length +
                      visibleFiles.length
                    } στοιχείο(α)`}
              </div>

              {!currentFolder && (
                <button
                  type="button"
                  disabled={
                    creatingFolder
                  }
                  onClick={
                    createFolder
                  }
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
                >
                  <Plus size={16} />

                  Νέος φάκελος
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Explorer content */}
        <div className="min-h-[420px] p-2 sm:p-4 lg:p-5">
          {loadingFolders &&
          !currentFolder ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Φόρτωση φακέλων…
            </div>
          ) : visibleFolders.length ===
              0 &&
            visibleFiles.length ===
              0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              {currentFolder
                ? "Ο φάκελος είναι κενός."
                : "Δεν βρέθηκαν αρχεία ή φάκελοι."}
            </div>
          ) : (
            <div
              className="
                grid
                grid-cols-2
                gap-x-2
                gap-y-4
                sm:grid-cols-3
                md:grid-cols-4
                lg:grid-cols-5
                xl:grid-cols-6
                2xl:grid-cols-7
              "
            >
              {/* Folders */}
              {visibleFolders.map(
                (folder) => (
                  <div
                    key={
                      folder.id
                    }
                    className="
                      group
                      relative
                      flex
                      min-w-0
                      flex-col
                      items-center
                      rounded-lg
                      border
                      border-transparent
                      px-1
                      py-3
                      text-center
                      transition
                      hover:border-blue-200
                      hover:bg-blue-50/70
                      sm:px-2
                    "
                  >
                    <button
                      type="button"
                      onClick={() =>
                        openFolder(
                          folder.id
                        )
                      }
                      className="flex w-full min-w-0 flex-col items-center"
                      title={
                        folder.name
                      }
                    >
                      <div className="flex h-16 items-center justify-center sm:h-20">
                        <Folder
                          size={62}
                          strokeWidth={
                            1.35
                          }
                          className="text-amber-500 sm:h-[68px] sm:w-[68px]"
                        />
                      </div>

                      <div
                        className="
                          mt-1
                          w-full
                          overflow-hidden
                          break-words
                          text-xs
                          font-medium
                          leading-4
                          text-gray-800
                          sm:text-sm
                          sm:leading-5
                        "
                        style={{
                          display:
                            "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient:
                            "vertical",
                        }}
                      >
                        {folder.name}
                      </div>
                    </button>

                    <div className="mt-2 flex items-center justify-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() =>
                          openFolder(
                            folder.id
                          )
                        }
                        className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
                        title="Άνοιγμα"
                      >
                        <FolderOpen
                          size={15}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          renameFolder(
                            folder.id,
                            folder.name
                          )
                        }
                        className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
                        title="Μετονομασία"
                      >
                        <Pencil
                          size={15}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteFolder(
                            folder.id
                          )
                        }
                        className="rounded-md border bg-white p-1.5 text-red-600 hover:bg-red-50"
                        title="Διαγραφή φακέλου"
                      >
                        <Trash2
                          size={15}
                        />
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* PDF files */}
              {visibleFiles.map(
                (file) => {
                  const title =
                    file.title ||
                    file.originalName ||
                    "PDF";

                  return (
                    <div
                      key={
                        file.id
                      }
                      className="
                        group
                        relative
                        flex
                        min-w-0
                        flex-col
                        items-center
                        rounded-lg
                        border
                        border-transparent
                        px-1
                        py-3
                        text-center
                        transition
                        hover:border-blue-200
                        hover:bg-blue-50/70
                        sm:px-2
                      "
                    >
                      {file.url ? (
                        <a
                          href={
                            file.url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="flex w-full min-w-0 flex-col items-center"
                          title={
                            title
                          }
                        >
                          <div className="flex h-16 items-center justify-center sm:h-20">
                            <FileText
                              size={
                                56
                              }
                              strokeWidth={
                                1.4
                              }
                              className="text-red-600 sm:h-16 sm:w-16"
                            />
                          </div>

                          <div
                            className="
                              mt-1
                              w-full
                              overflow-hidden
                              break-words
                              text-xs
                              font-medium
                              leading-4
                              text-gray-800
                              sm:text-sm
                              sm:leading-5
                            "
                            style={{
                              display:
                                "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient:
                                "vertical",
                            }}
                          >
                            {title}
                          </div>
                        </a>
                      ) : (
                        <>
                          <div className="flex h-16 items-center justify-center sm:h-20">
                            <FileText
                              size={
                                56
                              }
                              strokeWidth={
                                1.4
                              }
                              className="text-red-600 sm:h-16 sm:w-16"
                            />
                          </div>

                          <div
                            className="
                              mt-1
                              w-full
                              overflow-hidden
                              break-words
                              text-xs
                              font-medium
                              leading-4
                              sm:text-sm
                              sm:leading-5
                            "
                            style={{
                              display:
                                "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient:
                                "vertical",
                            }}
                          >
                            {title}
                          </div>
                        </>
                      )}

                      {/* Actions */}
                      <div className="mt-2 flex items-center justify-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        {file.url && (
                          <>
                            <a
                              href={
                                file.url
                              }
                              target="_blank"
                              rel="noreferrer"
                              title="Προβολή"
                              className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
                            >
                              <Eye
                                size={
                                  15
                                }
                              />
                            </a>

                            <a
                              href={`${file.url}?download=1`}
                              target="_blank"
                              rel="noreferrer"
                              title="Λήψη"
                              className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
                            >
                              <Download
                                size={
                                  15
                                }
                              />
                            </a>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const options = [
                              "0 - Χωρίς φάκελο",
                              ...folders.map(
                                (
                                  folder,
                                  index
                                ) =>
                                  `${index + 1} - ${folder.name}`
                              ),
                            ];

                            const choice =
                              prompt(
                                `Μετακίνηση αρχείου:\n\n${options.join(
                                  "\n"
                                )}\n\nΓράψτε τον αριθμό του φακέλου:`
                              );

                            if (
                              choice === null
                            ) {
                              return;
                            }

                            const number =
                              Number(
                                choice
                              );

                            if (
                              Number.isNaN(
                                number
                              ) ||
                              number < 0 ||
                              number >
                                folders.length
                            ) {
                              alert(
                                "Μη έγκυρη επιλογή."
                              );
                              return;
                            }

                            movePdf(
                              file.id,
                              number === 0
                                ? null
                                : folders[
                                    number -
                                      1
                                  ].id
                            );
                          }}
                          title="Μετακίνηση σε φάκελο"
                          className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
                        >
                          <Folder
                            size={15}
                          />
                        </button>

                        <button
                          type="button"
                          disabled={
                            deletingFileId ===
                            file.id
                          }
                          onClick={() =>
                            deleteFile(
                              file.id
                            )
                          }
                          title="Διαγραφή"
                          className="rounded-md border bg-white p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2
                            size={15}
                          />
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}