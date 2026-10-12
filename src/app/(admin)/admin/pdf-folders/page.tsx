"use client";

import {
  Folder,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type FolderRow = {
  id: string;
  name: string;
  ownerId?: string | null;
  createdAt?: string;
};

function getErrorMessage(
  json: any,
  fallback: string
) {
  if (
    json?.error ===
    "folder_exists"
  ) {
    return "Υπάρχει ήδη φάκελος με αυτό το όνομα.";
  }

  if (
    json?.error ===
    "invalid_payload"
  ) {
    return "Μη έγκυρα στοιχεία.";
  }

  if (
    json?.error ===
    "not_found"
  ) {
    return "Ο φάκελος δεν βρέθηκε.";
  }

  return (
    json?.detail ||
    json?.error ||
    fallback
  );
}

export default function AdminPdfFoldersPage() {
  const [folders, setFolders] =
    useState<FolderRow[]>([]);

  const [
    selectedFolderId,
    setSelectedFolderId,
  ] = useState<string | null>(
    null
  );

  const [loading, setLoading] =
    useState(true);

  const [working, setWorking] =
    useState(false);

  const [folderSearch, setFolderSearch] =
    useState("");

  const [newName, setNewName] =
    useState("");

  const [
    renameValue,
    setRenameValue,
  ] = useState("");

  /*
   * ---------------------------------------------------------
   * LOAD SHARED FOLDERS
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   * We use /api/pdf-folders now.
   *
   * Admin GET without userId returns the
   * global/shared folders where ownerId = null.
   */
  const load = useCallback(
    async (
      preferredId?: string | null
    ) => {
      setLoading(true);

      try {
        const response =
          await fetch(
            `/api/pdf-folders?t=${Date.now()}`,
            {
              cache: "no-store",
            }
          );

        const json =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              json,
              "Αποτυχία φόρτωσης φακέλων."
            )
          );
        }

        const nextFolders: FolderRow[] =
          Array.isArray(
            json.folders
          )
            ? json.folders
            : [];

        setFolders(nextFolders);

        setSelectedFolderId(
          (current) => {
            const wanted =
              preferredId ??
              current;

            if (
              wanted &&
              nextFolders.some(
                (folder) =>
                  folder.id ===
                  wanted
              )
            ) {
              return wanted;
            }

            return (
              nextFolders[0]
                ?.id ?? null
            );
          }
        );
      } catch (
        error: any
      ) {
        console.error(
          "Failed to load shared PDF folders:",
          error
        );

        alert(
          error?.message ||
            "Αποτυχία φόρτωσης φακέλων."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Selected folder
   */
  const selectedFolder =
    useMemo(() => {
      if (
        !selectedFolderId
      ) {
        return null;
      }

      return (
        folders.find(
          (folder) =>
            folder.id ===
            selectedFolderId
        ) || null
      );
    }, [
      folders,
      selectedFolderId,
    ]);

  useEffect(() => {
    setRenameValue(
      selectedFolder?.name ||
        ""
    );
  }, [
    selectedFolder?.id,
    selectedFolder?.name,
  ]);

  /*
   * Search
   */
  const filteredFolders =
    useMemo(() => {
      const q =
        folderSearch
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
      folderSearch,
    ]);

  /*
   * ---------------------------------------------------------
   * CREATE SHARED FOLDER
   * ---------------------------------------------------------
   */
  async function createFolder() {
    const name =
      newName.trim();

    if (!name) {
      alert(
        "Συμπληρώστε όνομα φακέλου."
      );
      return;
    }

    setWorking(true);

    try {
      const response =
        await fetch(
          "/api/pdf-folders",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                name,
                shared: true,
              }),
          }
        );

      const json =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            json,
            "Αποτυχία δημιουργίας φακέλου."
          )
        );
      }

      setNewName("");

      const createdId =
        json?.folder?.id ||
        null;

      await load(
        createdId
      );
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία δημιουργίας φακέλου."
      );
    } finally {
      setWorking(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * RENAME SHARED FOLDER
   * ---------------------------------------------------------
   */
  async function renameFolder() {
    if (!selectedFolder) {
      return;
    }

    const name =
      renameValue.trim();

    if (!name) {
      alert(
        "Συμπληρώστε νέο όνομα."
      );
      return;
    }

    if (
      name ===
      selectedFolder.name
    ) {
      return;
    }

    if (
      !confirm(
        `Να μετονομαστεί ο φάκελος "${selectedFolder.name}" σε "${name}";`
      )
    ) {
      return;
    }

    setWorking(true);

    try {
      const response =
        await fetch(
          `/api/pdf-folders/${selectedFolder.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                name,
              }),
          }
        );

      const json =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            json,
            "Αποτυχία μετονομασίας φακέλου."
          )
        );
      }

      await load(
        selectedFolder.id
      );
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία μετονομασίας φακέλου."
      );
    } finally {
      setWorking(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * DELETE SHARED FOLDER
   * ---------------------------------------------------------
   *
   * Existing PDF files are not deleted.
   * Your folder delete API detaches them
   * from the folder.
   */
  async function deleteFolder() {
    if (!selectedFolder) {
      return;
    }

    if (
      !confirm(
        `Να διαγραφεί ο κοινόχρηστος φάκελος "${selectedFolder.name}";\n\nΟ φάκελος θα εξαφανιστεί από όλους τους χρήστες. Τα PDF δεν θα διαγραφούν.`
      )
    ) {
      return;
    }

    setWorking(true);

    try {
      const response =
        await fetch(
          `/api/pdf-folders/${selectedFolder.id}`,
          {
            method:
              "DELETE",
          }
        );

      const json =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            json,
            "Αποτυχία διαγραφής φακέλου."
          )
        );
      }

      setSelectedFolderId(
        null
      );

      await load(null);
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία διαγραφής φακέλου."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="grid gap-4">
      {/* HEADER */}
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              PDF Φάκελοι
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Διαχείριση των
              κοινόχρηστων PDF
              φακέλων.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void load()
            }
            disabled={
              loading || working
            }
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Ανανέωση
          </button>
        </div>
      </header>

      {/* NEW FOLDER */}
      <section className="rounded-2xl border bg-[color:var(--card,#fff)] p-4">
        <h2 className="font-semibold">
          Νέος κοινόχρηστος
          φάκελος
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Ο φάκελος θα
          εμφανίζεται αυτόματα σε
          όλους τους χρήστες.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={newName}
            onChange={(
              event
            ) =>
              setNewName(
                event.target.value
              )
            }
            onKeyDown={(
              event
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                void createFolder();
              }
            }}
            placeholder="Όνομα νέου φακέλου"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={
              createFolder
            }
            disabled={
              working ||
              !newName.trim()
            }
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[color:var(--brand,#25C3F4)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            <Plus size={16} />

            {working
              ? "Επεξεργασία…"
              : "Δημιουργία φακέλου"}
          </button>
        </div>
      </section>

      {/* MAIN */}
      <div className="grid min-h-[620px] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* FOLDER LIST */}
        <section className="overflow-hidden rounded-2xl border bg-[color:var(--card,#fff)]">
          <div className="border-b p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  Όλοι οι φάκελοι
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {
                    folders.length
                  }{" "}
                  κοινόχρηστος/οι
                  φάκελος/οι
                </p>
              </div>

              <Folder
                size={22}
                className="text-amber-500"
              />
            </div>

            <input
              value={
                folderSearch
              }
              onChange={(
                event
              ) =>
                setFolderSearch(
                  event.target
                    .value
                )
              }
              placeholder="Αναζήτηση φακέλου…"
              className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>

          <div className="max-h-[650px] overflow-y-auto p-2">
            {loading ? (
              <div className="p-3 text-sm text-gray-500">
                Φόρτωση…
              </div>
            ) : filteredFolders.length ===
              0 ? (
              <div className="p-3 text-sm text-gray-500">
                Δεν βρέθηκαν
                φάκελοι.
              </div>
            ) : (
              filteredFolders.map(
                (folder) => (
                  <button
                    key={
                      folder.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedFolderId(
                        folder.id
                      )
                    }
                    className={`mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${
                      selectedFolderId ===
                      folder.id
                        ? "border-[color:var(--brand,#25C3F4)] bg-cyan-50"
                        : "border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <Folder
                      size={
                        22
                      }
                      className="shrink-0 text-amber-500"
                    />

                    <div className="min-w-0">
                      <span className="block break-words text-sm font-semibold">
                        {
                          folder.name
                        }
                      </span>

                      <span className="mt-1 block text-xs text-gray-500">
                        Κοινόχρηστος
                        φάκελος
                      </span>
                    </div>
                  </button>
                )
              )
            )}
          </div>
        </section>

        {/* DETAILS */}
        <section className="rounded-2xl border bg-[color:var(--card,#fff)] p-4">
          {!selectedFolder ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500">
              Επιλέξτε φάκελο.
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                    <Folder
                      size={
                        28
                      }
                      className="text-amber-500"
                    />
                  </div>

                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-semibold">
                      {
                        selectedFolder.name
                      }
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Αυτός είναι
                      κοινόχρηστος
                      φάκελος και
                      εμφανίζεται σε
                      όλους τους
                      χρήστες.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    deleteFolder
                  }
                  disabled={
                    working
                  }
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2
                    size={16}
                  />
                  Διαγραφή
                </button>
              </div>

              {/* RENAME */}
              <div className="rounded-xl border p-4">
                <h3 className="font-semibold">
                  Μετονομασία
                  φακέλου
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Η αλλαγή θα
                  εμφανιστεί σε όλους
                  τους χρήστες.
                </p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={
                      renameValue
                    }
                    onChange={(
                      event
                    ) =>
                      setRenameValue(
                        event.target
                          .value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        void renameFolder();
                      }
                    }}
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                  />

                  <button
                    type="button"
                    onClick={
                      renameFolder
                    }
                    disabled={
                      working ||
                      !renameValue.trim() ||
                      renameValue.trim() ===
                        selectedFolder.name
                    }
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Pencil
                      size={16}
                    />

                    Μετονομασία
                  </button>
                </div>
              </div>

              {/* INFO */}
              <div className="rounded-xl border bg-gray-50 p-4">
                <h3 className="text-sm font-semibold">
                  Κοινόχρηστος
                  φάκελος
                </h3>

                <div className="mt-3 grid gap-2 text-sm text-gray-600">
                  <div>
                    <span className="font-medium text-gray-900">
                      ID:
                    </span>{" "}
                    {
                      selectedFolder.id
                    }
                  </div>

                  <div>
                    <span className="font-medium text-gray-900">
                      Πρόσβαση:
                    </span>{" "}
                    Όλοι οι χρήστες
                  </div>

                  <div>
                    <span className="font-medium text-gray-900">
                      Τύπος:
                    </span>{" "}
                    Shared / Global
                  </div>

                  {selectedFolder.createdAt && (
                    <div>
                      <span className="font-medium text-gray-900">
                        Δημιουργήθηκε:
                      </span>{" "}
                      {new Date(
                        selectedFolder.createdAt
                      ).toLocaleString(
                        "el-GR"
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}