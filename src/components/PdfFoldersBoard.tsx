"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
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

  /*
   * For the normal USER this is already
   * resolved by GET /api/files from:
   *
   * FileAssignment.pdfFolderId
   *
   * for THIS logged-in user.
   */
  pdfFolderId?: string | null;

  pdfFolder?: {
    id: string;
    name: string;
    ownerId?: string | null;
  } | null;
};

type FolderItem = {
  id: string;
  name: string;
  ownerId?: string | null;
  createdAt?: string;
};

function isPdfFile(
  file: FileItem
) {
  const mime = (
    file.mime || ""
  ).toLowerCase();

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

function filenameWithoutExtension(
  name: string
) {
  return name.replace(
    /\.[^/.]+$/,
    ""
  );
}

function cleanUploadedFilename(
  name: string
) {
  const withoutExtension =
    filenameWithoutExtension(name);

  return withoutExtension.replace(
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}__?/i,
    ""
  );
}

function formatSize(
  bytes?: number | null
) {
  if (
    !bytes ||
    bytes <= 0
  ) {
    return "";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  let value = bytes;
  let index = 0;

  while (
    value >= 1024 &&
    index <
      units.length - 1
  ) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(
    value < 10 &&
      index > 0
      ? 1
      : 0
  )} ${units[index]}`;
}

function getErrorMessage(
  json: any,
  fallback: string
) {
  if (
    json?.error ===
    "folder_owner_mismatch"
  ) {
    return "Ο φάκελος δεν ανήκει στον χρήστη.";
  }

  if (
    json?.error ===
    "folder_not_found"
  ) {
    return "Ο φάκελος δεν βρέθηκε.";
  }

  if (
    json?.error ===
    "legacy_global_folder"
  ) {
    return "Ο συγκεκριμένος φάκελος δεν είναι πλέον διαθέσιμος.";
  }

  if (
    json?.error ===
    "file_not_assigned_to_user"
  ) {
    return "Το PDF δεν είναι ανατεθειμένο στον συγκεκριμένο χρήστη.";
  }

  if (
    json?.error ===
    "forbidden"
  ) {
    return "Δεν έχετε δικαίωμα για αυτή την ενέργεια.";
  }

  return (
    json?.detail ||
    json?.error ||
    fallback
  );
}

export default function PdfFoldersBoard({
  initialFiles,
}: {
  initialFiles: FileItem[];
}) {
  const [
    files,
    setFiles,
  ] =
    useState<FileItem[]>(
      (
        initialFiles ??
        []
      ).filter(
        isPdfFile
      )
    );

  const [
    folders,
    setFolders,
  ] =
    useState<
      FolderItem[]
    >([]);

  const [
    loadingFolders,
    setLoadingFolders,
  ] = useState(true);

  const [
    refreshingFiles,
    setRefreshingFiles,
  ] = useState(false);

  const [
    currentFolderId,
    setCurrentFolderId,
  ] =
    useState<
      string | null
    >(null);

  const [
    query,
    setQuery,
  ] = useState("");

  /*
   * Upload
   */
  const [
    newTitle,
    setNewTitle,
  ] = useState("");

  const [
    newFile,
    setNewFile,
  ] =
    useState<
      File | null
    >(null);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  /*
   * Move menu
   */
  const [
    moveMenuFileId,
    setMoveMenuFileId,
  ] =
    useState<
      string | null
    >(null);

  const currentFolder =
    useMemo(() => {
      if (
        !currentFolderId
      ) {
        return null;
      }

      return (
        folders.find(
          (folder) =>
            folder.id ===
            currentFolderId
        ) || null
      );
    }, [
      folders,
      currentFolderId,
    ]);

  /*
   * If admin removes a folder while
   * this page is open, return safely
   * to root.
   */
  useEffect(() => {
    if (
      currentFolderId &&
      !folders.some(
        (folder) =>
          folder.id ===
          currentFolderId
      )
    ) {
      setCurrentFolderId(
        null
      );

      setMoveMenuFileId(
        null
      );
    }
  }, [
    folders,
    currentFolderId,
  ]);

  /*
   * Anything with no folder assignment
   * for THIS user appears at root.
   */
  const rootFiles =
    useMemo(() => {
      return files.filter(
        (file) =>
          !file.pdfFolderId
      );
    }, [files]);

  const currentFolderFiles =
    useMemo(() => {
      if (
        !currentFolderId
      ) {
        return rootFiles;
      }

      return files.filter(
        (file) =>
          file.pdfFolderId ===
          currentFolderId
      );
    }, [
      files,
      rootFiles,
      currentFolderId,
    ]);

  const visibleFolders =
    useMemo(() => {
      /*
       * Folders only appear
       * at Explorer root.
       */
      if (
        currentFolderId
      ) {
        return [];
      }

      const q =
        query
          .trim()
          .toLocaleLowerCase(
            "el"
          );

      if (!q) {
        return folders;
      }

      return folders.filter(
        (folder) =>
          folder.name
            .toLocaleLowerCase(
              "el"
            )
            .includes(q)
      );
    }, [
      folders,
      query,
      currentFolderId,
    ]);

  const visibleFiles =
    useMemo(() => {
      const q =
        query
          .trim()
          .toLocaleLowerCase(
            "el"
          );

      if (!q) {
        return currentFolderFiles;
      }

      return currentFolderFiles.filter(
        (file) => {
          const title = (
            file.title ||
            ""
          ).toLocaleLowerCase(
            "el"
          );

          const originalName =
            (
              file.originalName ||
              ""
            ).toLocaleLowerCase(
              "el"
            );

          return (
            title.includes(
              q
            ) ||
            originalName.includes(
              q
            )
          );
        }
      );
    }, [
      currentFolderFiles,
      query,
    ]);

  /*
   * -------------------------------------------------------
   * LOAD CURRENT USER'S FOLDERS
   * -------------------------------------------------------
   *
   * GET /api/pdf-folders as USER returns
   * only PdfFolder rows owned by that user.
   */
  async function loadFolders() {
    setLoadingFolders(
      true
    );

    try {
      const response =
        await fetch(
          `/api/pdf-folders?t=${Date.now()}`,
          {
            cache:
              "no-store",
          }
        );

      const json =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok
      ) {
        console.error(
          "Could not load PDF folders:",
          json
        );

        setFolders(
          []
        );

        return;
      }

      const nextFolders:
        FolderItem[] =
        Array.isArray(
          json.folders
        )
          ? json.folders
          : [];

      setFolders(
        nextFolders
      );

      setCurrentFolderId(
        (current) => {
          if (
            !current
          ) {
            return null;
          }

          return nextFolders.some(
            (folder) =>
              folder.id ===
              current
          )
            ? current
            : null;
        }
      );
    } catch (
      error
    ) {
      console.error(
        "Could not load PDF folders:",
        error
      );

      setFolders(
        []
      );
    } finally {
      setLoadingFolders(
        false
      );
    }
  }

  /*
   * -------------------------------------------------------
   * LOAD CURRENT USER'S FILES
   * -------------------------------------------------------
   *
   * GET /api/files resolves each PDF's
   * top-level pdfFolderId from THIS
   * user's FileAssignment.
   */
  async function refreshFiles() {
    setRefreshingFiles(
      true
    );

    try {
      const response =
        await fetch(
          `/api/files?t=${Date.now()}`,
          {
            cache:
              "no-store",
          }
        );

      const json =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok
      ) {
        console.error(
          "Could not refresh files:",
          json
        );

        return;
      }

      setFiles(
        (
          json.files ||
          []
        ).filter(
          isPdfFile
        )
      );
    } catch (
      error
    ) {
      console.error(
        "Could not refresh files:",
        error
      );
    } finally {
      setRefreshingFiles(
        false
      );
    }
  }

  async function refreshAll() {
    await Promise.all([
      loadFolders(),
      refreshFiles(),
    ]);
  }

  useEffect(() => {
    void loadFolders();
  }, []);

  /*
   * -------------------------------------------------------
   * UPLOAD PDF
   * -------------------------------------------------------
   *
   * Normal user is assigned automatically
   * to themselves by POST /api/files.
   *
   * When uploading while inside a folder,
   * that physical personal folder ID is
   * written to FileAssignment.pdfFolderId.
   */
  async function uploadPdf() {
    if (
      !newFile ||
      !newTitle.trim()
    ) {
      alert(
        "Συμπληρώστε τίτλο και επιλέξτε αρχείο PDF."
      );

      return;
    }

    const validPdf =
      newFile.name
        .toLowerCase()
        .endsWith(
          ".pdf"
        ) ||
      newFile.type ===
        "application/pdf";

    if (!validPdf) {
      alert(
        "Σε αυτή τη σελίδα επιτρέπονται μόνο αρχεία PDF."
      );

      return;
    }

    setUploading(
      true
    );

    try {
      const formData =
        new FormData();

      formData.append(
        "title",
        newTitle.trim()
      );

      formData.append(
        "file",
        newFile
      );

      /*
       * This is THIS user's own
       * physical folder ID.
       */
      if (
        currentFolderId
      ) {
        formData.append(
          "pdfFolderId",
          currentFolderId
        );
      }

      const response =
        await fetch(
          "/api/files",
          {
            method:
              "POST",
            body:
              formData,
          }
        );

      const json =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (
        !response.ok
      ) {
        throw new Error(
          getErrorMessage(
            json,
            "Αποτυχία upload"
          )
        );
      }

      setNewTitle("");
      setNewFile(null);

      const input =
        document.getElementById(
          "pdf-file-upload-input"
        ) as
          | HTMLInputElement
          | null;

      if (input) {
        input.value = "";
      }

      await refreshFiles();
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία upload"
      );
    } finally {
      setUploading(
        false
      );
    }
  }

  /*
   * -------------------------------------------------------
   * MOVE PDF
   * -------------------------------------------------------
   *
   * This updates ONLY this user's
   * FileAssignment.pdfFolderId.
   *
   * If the same physical PDF is shared
   * with 30 other users, their folder
   * positions remain unchanged.
   */
  async function movePdf(
    fileId: string,
    folderId:
      | string
      | null
  ) {
    const response =
      await fetch(
        `/api/files/${fileId}/pdf-folder`,
        {
          method:
            "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              pdfFolderId:
                folderId,
            }),
        }
      );

    const json =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (
      !response.ok
    ) {
      alert(
        getErrorMessage(
          json,
          "Αποτυχία μετακίνησης PDF."
        )
      );

      return false;
    }

    setMoveMenuFileId(
      null
    );

    /*
     * Reload from server instead of
     * guessing locally.
     *
     * GET /api/files returns this user's
     * assignment-level folder ID.
     */
    await refreshFiles();

    return true;
  }

  function openFolder(
    folderId: string
  ) {
    setCurrentFolderId(
      folderId
    );

    setMoveMenuFileId(
      null
    );

    setQuery("");
  }

  function goToRoot() {
    setCurrentFolderId(
      null
    );

    setMoveMenuFileId(
      null
    );

    setQuery("");
  }

  return (
    <div className="space-y-4">
      {/* UPLOAD */}
      <section className="rounded-xl border bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold">
              Προσθήκη PDF
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              {currentFolder
                ? `Το αρχείο θα προστεθεί στον προσωπικό σας φάκελο "${currentFolder.name}".`
                : "Το αρχείο θα προστεθεί στα υπόλοιπα αρχεία τεκμηρίωσης."}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void refreshAll()
            }
            disabled={
              loadingFolders ||
              refreshingFiles
            }
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                loadingFolders ||
                refreshingFiles
                  ? "animate-spin"
                  : ""
              }
            />

            Ανανέωση
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
          <input
            className="w-full min-w-0 rounded-lg border px-3 py-2 text-sm"
            placeholder="Τίτλος αρχείου"
            value={
              newTitle
            }
            onChange={(
              event
            ) =>
              setNewTitle(
                event.target
                  .value
              )
            }
          />

          <input
            id="pdf-file-upload-input"
            type="file"
            accept=".pdf,application/pdf"
            className="w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm"
            onChange={(
              event
            ) => {
              const pickedFile =
                event
                  .currentTarget
                  .files?.[0] ??
                null;

              setNewFile(
                pickedFile
              );

              if (
                pickedFile
              ) {
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
            disabled={
              uploading
            }
            onClick={
              uploadPdf
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 md:w-auto"
            style={{
              backgroundColor:
                "var(--brand,#25C3F4)",
              color:
                "#061630",
            }}
          >
            <Upload
              size={17}
            />

            {uploading
              ? "Upload…"
              : "Προσθήκη"}
          </button>
        </div>
      </section>

      {/* EXPLORER */}
      <section className="overflow-visible rounded-xl border bg-white">
        <div className="border-b bg-gray-50">
          {/* BREADCRUMB */}
          <div className="flex min-h-[50px] items-center gap-2 border-b px-3 py-2 sm:px-4">
            {currentFolder ? (
              <button
                type="button"
                onClick={
                  goToRoot
                }
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
                onClick={
                  goToRoot
                }
                className={[
                  "truncate",

                  currentFolder
                    ? "text-gray-500 hover:text-gray-900"
                    : "font-medium text-gray-900",
                ].join(
                  " "
                )}
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

          {/* SEARCH */}
          <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <input
              value={
                query
              }
              onChange={(
                event
              ) =>
                setQuery(
                  event.target
                    .value
                )
              }
              placeholder={
                currentFolder
                  ? "Αναζήτηση στον φάκελο..."
                  : "Αναζήτηση φακέλων και PDF..."
              }
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm sm:max-w-[440px]"
            />

            <div className="flex items-center gap-3">
              {(loadingFolders ||
                refreshingFiles) && (
                <RefreshCw
                  size={14}
                  className="animate-spin text-gray-400"
                />
              )}

              <div className="text-sm text-gray-500">
                {currentFolder
                  ? `${visibleFiles.length} αρχείο(α)`
                  : `${
                      visibleFolders.length +
                      visibleFiles.length
                    } στοιχείο(α)`}
              </div>
            </div>
          </div>
        </div>

        {/* EXPLORER CONTENT */}
        <div className="min-h-[420px] p-2 sm:p-4 lg:p-5">
          {loadingFolders &&
          folders.length ===
            0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Φόρτωση
              φακέλων…
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
            <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {/* FOLDERS */}
              {visibleFolders.map(
                (
                  folder
                ) => (
                  <div
                    key={
                      folder.id
                    }
                    className="group relative flex min-w-0 flex-col items-center rounded-lg border border-transparent px-1 py-3 text-center transition hover:border-blue-200 hover:bg-blue-50/70 sm:px-2"
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
                        className="mt-1 w-full overflow-hidden break-words text-xs font-medium leading-4 text-gray-800 sm:text-sm sm:leading-5"
                        style={{
                          display:
                            "-webkit-box",

                          WebkitLineClamp:
                            3,

                          WebkitBoxOrient:
                            "vertical",
                        }}
                      >
                        {
                          folder.name
                        }
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
                    </div>
                  </div>
                )
              )}

              {/* PDF FILES */}
              {visibleFiles.map(
                (
                  file
                ) => {
                  const title =
                    file.title ||
                    file.originalName ||
                    "PDF";

                  return (
                    <div
                      key={
                        file.id
                      }
                      className="group relative flex min-w-0 flex-col items-center rounded-lg border border-transparent px-1 py-3 text-center transition hover:border-blue-200 hover:bg-blue-50/70 sm:px-2"
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
                              size={56}
                              strokeWidth={
                                1.4
                              }
                              className="text-red-600 sm:h-16 sm:w-16"
                            />
                          </div>

                          <FileName
                            title={
                              title
                            }
                          />
                        </a>
                      ) : (
                        <>
                          <div className="flex h-16 items-center justify-center sm:h-20">
                            <FileText
                              size={56}
                              strokeWidth={
                                1.4
                              }
                              className="text-red-600 sm:h-16 sm:w-16"
                            />
                          </div>

                          <FileName
                            title={
                              title
                            }
                          />
                        </>
                      )}

                      {formatSize(
                        file.size
                      ) && (
                        <div className="mt-1 text-[10px] text-gray-400">
                          {formatSize(
                            file.size
                          )}
                        </div>
                      )}

                      {/* FILE ACTIONS */}
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
                                size={15}
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
                                size={15}
                              />
                            </a>
                          </>
                        )}

                        {/* MOVE */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setMoveMenuFileId(
                                (
                                  current
                                ) =>
                                  current ===
                                  file.id
                                    ? null
                                    : file.id
                              )
                            }
                            title="Μετακίνηση σε φάκελο"
                            className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
                          >
                            <Folder
                              size={15}
                            />
                          </button>

                          {moveMenuFileId ===
                            file.id && (
                            <div className="absolute left-1/2 top-full z-[200] mt-2 max-h-72 w-56 -translate-x-1/2 overflow-y-auto rounded-lg border bg-white py-1 text-left shadow-xl">
                              <div className="border-b px-3 py-2 text-xs font-semibold text-gray-500">
                                Μετακίνηση
                                σε
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  void movePdf(
                                    file.id,
                                    null
                                  )
                                }
                                className={[
                                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100",

                                  !file.pdfFolderId
                                    ? "bg-gray-50 font-medium"
                                    : "",
                                ].join(
                                  " "
                                )}
                              >
                                <Folder
                                  size={15}
                                  className="shrink-0 text-gray-400"
                                />

                                <span className="truncate">
                                  Χωρίς
                                  φάκελο
                                </span>
                              </button>

                              {folders.length >
                              0 ? (
                                folders.map(
                                  (
                                    folder
                                  ) => (
                                    <button
                                      key={
                                        folder.id
                                      }
                                      type="button"
                                      onClick={() =>
                                        void movePdf(
                                          file.id,
                                          folder.id
                                        )
                                      }
                                      className={[
                                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100",

                                        file.pdfFolderId ===
                                        folder.id
                                          ? "bg-gray-50 font-medium"
                                          : "",
                                      ].join(
                                        " "
                                      )}
                                    >
                                      <Folder
                                        size={15}
                                        className="shrink-0 text-amber-500"
                                      />

                                      <span className="truncate">
                                        {
                                          folder.name
                                        }
                                      </span>
                                    </button>
                                  )
                                )
                              ) : (
                                <div className="px-3 py-2 text-xs text-gray-500">
                                  Δεν υπάρχουν
                                  φάκελοι.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
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

function FileName({
  title,
}: {
  title: string;
}) {
  return (
    <div
      className="mt-1 w-full overflow-hidden break-words text-xs font-medium leading-4 text-gray-800 sm:text-sm sm:leading-5"
      style={{
        display:
          "-webkit-box",

        WebkitLineClamp:
          3,

        WebkitBoxOrient:
          "vertical",
      }}
    >
      {title}
    </div>
  );
}