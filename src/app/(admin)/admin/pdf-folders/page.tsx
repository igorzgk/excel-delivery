"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Folder,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role?: string;
  status?: string;
};

type FolderUser = {
  id: string;
  email: string;
  name: string | null;
  status?: string;
  folderId: string;
};

type FolderGroup = {
  name: string;
  count: number;
  totalUsers: number;
  missingCount: number;
  complete: boolean;
  folderIds: string[];
  users: FolderUser[];
  createdAt: string;
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
  const [
    folders,
    setFolders,
  ] = useState<FolderGroup[]>(
    []
  );

  const [
    users,
    setUsers,
  ] = useState<UserRow[]>([]);

  const [
    totalUsers,
    setTotalUsers,
  ] = useState(0);

  const [
    selectedName,
    setSelectedName,
  ] = useState<string | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    working,
    setWorking,
  ] = useState(false);

  const [
    folderSearch,
    setFolderSearch,
  ] = useState("");

  const [
    newName,
    setNewName,
  ] = useState("");

  const [
    renameValue,
    setRenameValue,
  ] = useState("");

  /*
   * ---------------------------------------------------------
   * LOAD LOGICAL PDF FOLDERS
   * ---------------------------------------------------------
   *
   * /api/admin/pdf-folders returns grouped personal folders.
   *
   * Example:
   *
   * User A -> ΑΡΧΕΙΟ ΝΕΡΟΥ -> folder A
   * User B -> ΑΡΧΕΙΟ ΝΕΡΟΥ -> folder B
   *
   * appears here as ONE logical:
   *
   * ΑΡΧΕΙΟ ΝΕΡΟΥ
   * 2 / 2 users
   */
  const load = useCallback(
    async (
      preferredName?:
        | string
        | null
    ) => {
      setLoading(true);

      try {
        const response =
          await fetch(
            "/api/admin/pdf-folders",
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
          throw new Error(
            getErrorMessage(
              json,
              "Αποτυχία φόρτωσης φακέλων."
            )
          );
        }

        const nextFolders: FolderGroup[] =
          Array.isArray(
            json.folders
          )
            ? json.folders
            : [];

        const nextUsers: UserRow[] =
          Array.isArray(
            json.users
          )
            ? json.users
            : [];

        setFolders(
          nextFolders
        );

        setUsers(
          nextUsers
        );

        setTotalUsers(
          typeof json.totalUsers ===
            "number"
            ? json.totalUsers
            : nextUsers.length
        );

        setSelectedName(
          (current) => {
            const wanted =
              preferredName !==
              undefined
                ? preferredName
                : current;

            if (
              wanted &&
              nextFolders.some(
                (folder) =>
                  folder.name ===
                  wanted
              )
            ) {
              return wanted;
            }

            return (
              nextFolders[0]
                ?.name ??
              null
            );
          }
        );
      } catch (
        error: any
      ) {
        console.error(
          "Failed to load PDF folders:",
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
   * Selected logical folder.
   */
  const selectedFolder =
    useMemo(() => {
      if (
        !selectedName
      ) {
        return null;
      }

      return (
        folders.find(
          (folder) =>
            folder.name ===
            selectedName
        ) || null
      );
    }, [
      folders,
      selectedName,
    ]);

  useEffect(() => {
    setRenameValue(
      selectedFolder?.name ||
        ""
    );
  }, [
    selectedFolder?.name,
  ]);

  /*
   * ---------------------------------------------------------
   * SEARCH
   * ---------------------------------------------------------
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
   * USERS WHO DO / DO NOT HAVE SELECTED FOLDER
   * ---------------------------------------------------------
   */
  const selectedOwnerIds =
    useMemo(() => {
      return new Set(
        (
          selectedFolder
            ?.users || []
        ).map(
          (user) =>
            user.id
        )
      );
    }, [
      selectedFolder,
    ]);

  const missingUsers =
    useMemo(() => {
      if (
        !selectedFolder
      ) {
        return [];
      }

      return users.filter(
        (user) =>
          !selectedOwnerIds.has(
            user.id
          )
      );
    }, [
      users,
      selectedOwnerIds,
      selectedFolder,
    ]);

  /*
   * ---------------------------------------------------------
   * CREATE STANDARD FOLDER
   * ---------------------------------------------------------
   *
   * Backend creates one personal copy
   * for every USER.
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
          "/api/admin/pdf-folders",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  name,
                }
              ),
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
            "Αποτυχία δημιουργίας φακέλου."
          )
        );
      }

      setNewName("");

      await load(name);
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
   * REPAIR MISSING PERSONAL COPIES
   * ---------------------------------------------------------
   *
   * POSTing an existing folder name again
   * creates only the copies missing from users.
   */
  async function repairFolder() {
    if (
      !selectedFolder
    ) {
      return;
    }

    if (
      selectedFolder
        .missingCount === 0
    ) {
      return;
    }

    if (
      !confirm(
        `Να δημιουργηθεί ο φάκελος "${selectedFolder.name}" στους ${selectedFolder.missingCount} χρήστες που τον στερούνται;`
      )
    ) {
      return;
    }

    setWorking(true);

    try {
      const response =
        await fetch(
          "/api/admin/pdf-folders",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  name:
                    selectedFolder.name,
                }
              ),
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
            "Αποτυχία δημιουργίας των φακέλων που λείπουν."
          )
        );
      }

      await load(
        selectedFolder.name
      );

      alert(
        `Ολοκληρώθηκε.\nΔημιουργήθηκαν: ${
          json.created ?? 0
        }\nΥπήρχαν ήδη: ${
          json.skipped ?? 0
        }`
      );
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία επιδιόρθωσης φακέλου."
      );
    } finally {
      setWorking(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * RENAME STANDARD FOLDER
   * ---------------------------------------------------------
   *
   * Backend renames all personal copies.
   */
  async function renameFolder() {
    if (
      !selectedFolder
    ) {
      return;
    }

    const newFolderName =
      renameValue.trim();

    if (
      !newFolderName
    ) {
      alert(
        "Συμπληρώστε νέο όνομα."
      );

      return;
    }

    if (
      newFolderName ===
      selectedFolder.name
    ) {
      return;
    }

    if (
      !confirm(
        `Να μετονομαστεί ο φάκελος "${selectedFolder.name}" σε "${newFolderName}" για όλους τους χρήστες;`
      )
    ) {
      return;
    }

    setWorking(true);

    try {
      const response =
        await fetch(
          "/api/admin/pdf-folders",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  oldName:
                    selectedFolder.name,

                  newName:
                    newFolderName,
                }
              ),
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
            "Αποτυχία μετονομασίας φακέλου."
          )
        );
      }

      setSelectedName(
        newFolderName
      );

      await load(
        newFolderName
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
   * DELETE STANDARD FOLDER
   * ---------------------------------------------------------
   *
   * Backend:
   * - finds every user's personal copy
   * - detaches PDFs
   * - deletes all folder copies
   *
   * PDFs themselves are NOT deleted.
   */
  async function deleteFolder() {
    if (
      !selectedFolder
    ) {
      return;
    }

    if (
      !confirm(
        `Να διαγραφεί ο φάκελος "${selectedFolder.name}" από όλους τους χρήστες;\n\nΤα PDF μέσα στους φακέλους δεν θα διαγραφούν. Θα μεταφερθούν στα αρχεία χωρίς φάκελο.`
      )
    ) {
      return;
    }

    setWorking(true);

    try {
      const response =
        await fetch(
          "/api/admin/pdf-folders",
          {
            method:
              "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  name:
                    selectedFolder.name,
                }
              ),
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
            "Αποτυχία διαγραφής φακέλου."
          )
        );
      }

      const deletedName =
        selectedFolder.name;

      setSelectedName(
        null
      );

      await load(null);

      alert(
        `Ο φάκελος "${deletedName}" διαγράφηκε.\n\nΔιαγράφηκαν φάκελοι χρηστών: ${
          json.deletedFolders ??
          0
        }\nPDF που αποσυνδέθηκαν: ${
          json.detachedFiles ??
          0
        }`
      );
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
              Διαχείριση της κοινής
              δομής φακέλων PDF για
              όλους τους χρήστες.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void load()
            }
            disabled={
              loading ||
              working
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

      {/* EXPLANATION */}
      <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex items-start gap-3">
          <Users
            size={20}
            className="mt-0.5 shrink-0 text-blue-700"
          />

          <div>
            <div className="text-sm font-semibold text-blue-950">
              Ίδια δομή φακέλων,
              ξεχωριστό περιεχόμενο
              ανά χρήστη
            </div>

            <p className="mt-1 text-sm text-blue-900/75">
              Κάθε φάκελος της
              λίστας δημιουργείται
              ξεχωριστά για κάθε
              χρήστη. Τα ονόματα
              παραμένουν κοινά,
              αλλά κάθε χρήστης
              έχει το δικό του
              folder ID και τα δικά
              του PDF.
            </p>
          </div>
        </div>
      </section>

      {/* NEW FOLDER */}
      <section className="rounded-2xl border bg-[color:var(--card,#fff)] p-4">
        <h2 className="font-semibold">
          Νέος φάκελος
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Θα δημιουργηθεί ξεχωριστό
          αντίγραφο του φακέλου για
          κάθε χρήστη.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={
              newName
            }
            onChange={(
              event
            ) =>
              setNewName(
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
            <Plus
              size={16}
            />

            {working
              ? "Επεξεργασία…"
              : "Δημιουργία φακέλου"}
          </button>
        </div>
      </section>

      {/* MAIN */}
      <div className="grid min-h-[620px] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
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
                  φάκελος/οι •{" "}
                  {
                    totalUsers
                  }{" "}
                  χρήστης/ες
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
                      folder.name
                    }
                    type="button"
                    onClick={() =>
                      setSelectedName(
                        folder.name
                      )
                    }
                    className={`mb-1 flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left ${
                      selectedName ===
                      folder.name
                        ? "border-[color:var(--brand,#25C3F4)] bg-cyan-50"
                        : "border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <Folder
                      size={22}
                      className="mt-0.5 shrink-0 text-amber-500"
                    />

                    <div className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold">
                        {
                          folder.name
                        }
                      </span>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500">
                          {
                            folder.count
                          }
                          {" / "}
                          {
                            folder.totalUsers
                          }{" "}
                          χρήστες
                        </span>

                        {folder.complete ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2
                              size={
                                12
                              }
                            />
                            Πλήρης
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <AlertTriangle
                              size={
                                12
                              }
                            />

                            Λείπει από{" "}
                            {
                              folder.missingCount
                            }
                          </span>
                        )}
                      </div>
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
              {/* TITLE */}
              <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                    <Folder
                      size={28}
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
                      {
                        selectedFolder.count
                      }
                      {" / "}
                      {
                        selectedFolder.totalUsers
                      }{" "}
                      χρήστες έχουν
                      ξεχωριστό
                      αντίγραφο αυτού
                      του φακέλου.
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

              {/* STATUS */}
              {selectedFolder.complete ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      size={20}
                      className="mt-0.5 shrink-0 text-emerald-700"
                    />

                    <div>
                      <h3 className="font-semibold text-emerald-900">
                        Η δομή είναι
                        πλήρης
                      </h3>

                      <p className="mt-1 text-sm text-emerald-800/80">
                        Όλοι οι{" "}
                        {
                          selectedFolder.totalUsers
                        }{" "}
                        χρήστες έχουν
                        τον συγκεκριμένο
                        φάκελο.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        size={20}
                        className="mt-0.5 shrink-0 text-amber-700"
                      />

                      <div>
                        <h3 className="font-semibold text-amber-900">
                          Λείπει από{" "}
                          {
                            selectedFolder.missingCount
                          }{" "}
                          χρήστη/ες
                        </h3>

                        <p className="mt-1 text-sm text-amber-800/80">
                          Μπορείτε να
                          δημιουργήσετε
                          αυτόματα μόνο
                          τα αντίγραφα
                          που λείπουν.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={
                        repairFolder
                      }
                      disabled={
                        working
                      }
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                    >
                      <Wrench
                        size={16}
                      />

                      Δημιουργία
                      στους χρήστες
                      που λείπει
                    </button>
                  </div>
                </div>
              )}

              {/* RENAME */}
              <div className="rounded-xl border p-4">
                <h3 className="font-semibold">
                  Μετονομασία
                  φακέλου
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Η αλλαγή θα
                  εφαρμοστεί στα
                  προσωπικά αντίγραφα
                  όλων των χρηστών.
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

              {/* USERS WITH FOLDER */}
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      Χρήστες με
                      τον φάκελο
                    </h3>

                    <p className="mt-1 text-xs text-gray-500">
                      Κάθε χρήστης
                      έχει διαφορετικό
                      folder ID.
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {
                      selectedFolder.count
                    }
                    {" / "}
                    {
                      selectedFolder.totalUsers
                    }
                  </span>
                </div>

                <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border bg-gray-50 p-2">
                  {selectedFolder.users
                    .length ===
                  0 ? (
                    <div className="p-3 text-sm text-gray-500">
                      Κανένας
                      χρήστης δεν
                      έχει ακόμη τον
                      φάκελο.
                    </div>
                  ) : (
                    selectedFolder.users.map(
                      (
                        user
                      ) => (
                        <div
                          key={
                            user.id
                          }
                          className="flex items-start justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white"
                        >
                          <div className="min-w-0">
                            <div className="break-words text-sm font-medium">
                              {
                                user.email
                              }
                            </div>

                            {user.name && (
                              <div className="mt-0.5 text-xs text-gray-500">
                                {
                                  user.name
                                }
                              </div>
                            )}
                          </div>

                          <CheckCircle2
                            size={16}
                            className="mt-0.5 shrink-0 text-emerald-600"
                          />
                        </div>
                      )
                    )
                  )}
                </div>
              </div>

              {/* MISSING USERS */}
              {missingUsers.length >
                0 && (
                <div className="rounded-xl border border-amber-200 p-4">
                  <h3 className="font-semibold">
                    Χρήστες χωρίς
                    τον φάκελο
                  </h3>

                  <p className="mt-1 text-xs text-gray-500">
                    Αυτοί οι
                    χρήστες δεν
                    έχουν ακόμη
                    προσωπικό
                    αντίγραφο.
                  </p>

                  <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border bg-amber-50/40 p-2">
                    {missingUsers.map(
                      (
                        user
                      ) => (
                        <div
                          key={
                            user.id
                          }
                          className="flex items-start gap-2 rounded-lg px-3 py-2"
                        >
                          <AlertTriangle
                            size={15}
                            className="mt-0.5 shrink-0 text-amber-600"
                          />

                          <div className="min-w-0">
                            <div className="break-words text-sm font-medium">
                              {
                                user.email
                              }
                            </div>

                            {user.name && (
                              <div className="text-xs text-gray-500">
                                {
                                  user.name
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* INFO */}
              <div className="rounded-xl border bg-gray-50 p-4">
                <h3 className="text-sm font-semibold">
                  Πληροφορίες
                  δομής
                </h3>

                <div className="mt-3 grid gap-2 text-sm text-gray-600">
                  <div>
                    <span className="font-medium text-gray-900">
                      Όνομα:
                    </span>{" "}
                    {
                      selectedFolder.name
                    }
                  </div>

                  <div>
                    <span className="font-medium text-gray-900">
                      Χρήστες:
                    </span>{" "}
                    {
                      selectedFolder.count
                    }
                    {" / "}
                    {
                      selectedFolder.totalUsers
                    }
                  </div>

                  <div>
                    <span className="font-medium text-gray-900">
                      Τύπος:
                    </span>{" "}
                    Προσωπικός
                    φάκελος ανά
                    χρήστη
                  </div>

                  <div>
                    <span className="font-medium text-gray-900">
                      Περιεχόμενο:
                    </span>{" "}
                    Ξεχωριστό PDF
                    περιεχόμενο ανά
                    χρήστη
                  </div>

                  {selectedFolder.createdAt && (
                    <div>
                      <span className="font-medium text-gray-900">
                        Πρώτη
                        δημιουργία:
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