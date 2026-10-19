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
    "invalid_payload"
  ) {
    return "Μη έγκυρα στοιχεία.";
  }

  if (
    json?.error ===
    "no_users_selected"
  ) {
    return "Επιλέξτε τουλάχιστον έναν χρήστη.";
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
  ] = useState<
    FolderGroup[]
  >([]);

  const [
    users,
    setUsers,
  ] = useState<
    UserRow[]
  >([]);

  const [
    totalUsers,
    setTotalUsers,
  ] = useState(0);

  const [
    selectedName,
    setSelectedName,
  ] = useState<
    string | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    working,
    setWorking,
  ] = useState(false);

  /*
   * Folder list search
   */
  const [
    folderSearch,
    setFolderSearch,
  ] = useState("");

  /*
   * New folder
   */
  const [
    newName,
    setNewName,
  ] = useState("");

  const [
    newUserSearch,
    setNewUserSearch,
  ] = useState("");

  const [
    newSelectedUserIds,
    setNewSelectedUserIds,
  ] = useState<
    string[]
  >([]);

  /*
   * Existing folder membership
   */
  const [
    memberSearch,
    setMemberSearch,
  ] = useState("");

  const [
    memberSelections,
    setMemberSelections,
  ] = useState<
    string[]
  >([]);

  /*
   * Rename
   */
  const [
    renameValue,
    setRenameValue,
  ] = useState("");

  /*
   * -------------------------------------------------------
   * LOAD
   * -------------------------------------------------------
   */
  const load =
    useCallback(
      async (
        preferredName?:
          | string
          | null
      ) => {
        setLoading(true);

        try {
          const response =
            await fetch(
              `/api/admin/pdf-folders?t=${Date.now()}`,
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

          const nextFolders:
            FolderGroup[] =
            Array.isArray(
              json.folders
            )
              ? json.folders
              : [];

          const nextUsers:
            UserRow[] =
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
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * -------------------------------------------------------
   * SELECTED FOLDER
   * -------------------------------------------------------
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

  /*
   * Whenever a folder is selected/reloaded,
   * initialize its current user membership.
   */
  useEffect(() => {
    if (
      !selectedFolder
    ) {
      setMemberSelections(
        []
      );

      setRenameValue(
        ""
      );

      return;
    }

    setMemberSelections(
      selectedFolder.users.map(
        (user) =>
          user.id
      )
    );

    setRenameValue(
      selectedFolder.name
    );
  }, [
    selectedFolder,
  ]);

  /*
   * -------------------------------------------------------
   * SEARCHES
   * -------------------------------------------------------
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

  const filteredNewUsers =
    useMemo(() => {
      const q =
        newUserSearch
          .trim()
          .toLocaleLowerCase(
            "el"
          );

      if (!q) {
        return users;
      }

      return users.filter(
        (user) => {
          const email =
            user.email
              .toLocaleLowerCase(
                "el"
              );

          const name = (
            user.name || ""
          ).toLocaleLowerCase(
            "el"
          );

          return (
            email.includes(q) ||
            name.includes(q)
          );
        }
      );
    }, [
      users,
      newUserSearch,
    ]);

  const filteredMemberUsers =
    useMemo(() => {
      const q =
        memberSearch
          .trim()
          .toLocaleLowerCase(
            "el"
          );

      if (!q) {
        return users;
      }

      return users.filter(
        (user) => {
          const email =
            user.email
              .toLocaleLowerCase(
                "el"
              );

          const name = (
            user.name || ""
          ).toLocaleLowerCase(
            "el"
          );

          return (
            email.includes(q) ||
            name.includes(q)
          );
        }
      );
    }, [
      users,
      memberSearch,
    ]);

  function toggleId(
    current: string[],
    id: string
  ) {
    return current.includes(
      id
    )
      ? current.filter(
          (value) =>
            value !== id
        )
      : [
          ...current,
          id,
        ];
  }

  /*
   * -------------------------------------------------------
   * CREATE FOLDER
   * -------------------------------------------------------
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

    if (
      newSelectedUserIds.length ===
      0
    ) {
      alert(
        "Επιλέξτε τουλάχιστον έναν χρήστη."
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
              JSON.stringify({
                name,

                userIds:
                  newSelectedUserIds,
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
        throw new Error(
          getErrorMessage(
            json,
            "Αποτυχία δημιουργίας φακέλου."
          )
        );
      }

      setNewName("");

      setNewUserSearch(
        ""
      );

      setNewSelectedUserIds(
        []
      );

      await load(name);
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία δημιουργίας φακέλου."
      );
    } finally {
      setWorking(
        false
      );
    }
  }

  /*
   * -------------------------------------------------------
   * SAVE MEMBERSHIP
   * -------------------------------------------------------
   */
  async function saveMembership() {
    if (
      !selectedFolder
    ) {
      return;
    }

    const oldIds =
      new Set(
        selectedFolder.users.map(
          (user) =>
            user.id
        )
      );

    const newIds =
      new Set(
        memberSelections
      );

    const added =
      memberSelections.filter(
        (id) =>
          !oldIds.has(id)
      );

    const removed =
      selectedFolder.users.filter(
        (user) =>
          !newIds.has(
            user.id
          )
      );

    if (
      added.length ===
        0 &&
      removed.length ===
        0
    ) {
      alert(
        "Δεν υπάρχουν αλλαγές."
      );

      return;
    }

    if (
      removed.length >
      0
    ) {
      const confirmed =
        confirm(
          `Θα αφαιρεθεί ο φάκελος "${selectedFolder.name}" από ${removed.length} χρήστη/ες.\n\nΤα PDF δεν θα διαγραφούν, αλλά θα βγουν από αυτόν τον φάκελο για τους συγκεκριμένους χρήστες.\n\nΣυνέχεια;`
        );

      if (
        !confirmed
      ) {
        return;
      }
    }

    setWorking(true);

    try {
      const response =
        await fetch(
          "/api/admin/pdf-folders",
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                name:
                  selectedFolder.name,

                userIds:
                  memberSelections,
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
        throw new Error(
          getErrorMessage(
            json,
            "Αποτυχία ενημέρωσης χρηστών."
          )
        );
      }

      await load(
        selectedFolder.name
      );
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία ενημέρωσης χρηστών."
      );
    } finally {
      setWorking(
        false
      );
    }
  }

  /*
   * -------------------------------------------------------
   * RENAME
   * -------------------------------------------------------
   */
  async function renameFolder() {
    if (
      !selectedFolder
    ) {
      return;
    }

    const newName =
      renameValue.trim();

    if (!newName) {
      alert(
        "Συμπληρώστε νέο όνομα."
      );

      return;
    }

    if (
      newName ===
      selectedFolder.name
    ) {
      return;
    }

    if (
      !confirm(
        `Να μετονομαστεί ο φάκελος "${selectedFolder.name}" σε "${newName}";`
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
              JSON.stringify({
                oldName:
                  selectedFolder.name,

                newName,
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
        throw new Error(
          getErrorMessage(
            json,
            "Αποτυχία μετονομασίας."
          )
        );
      }

      await load(
        newName
      );
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία μετονομασίας."
      );
    } finally {
      setWorking(
        false
      );
    }
  }

  /*
   * -------------------------------------------------------
   * DELETE
   * -------------------------------------------------------
   */
  async function deleteFolder() {
    if (
      !selectedFolder
    ) {
      return;
    }

    if (
      !confirm(
        `Να διαγραφεί ο φάκελος "${selectedFolder.name}" από τους ${selectedFolder.count} χρήστες που τον έχουν;\n\nΤα PDF δεν θα διαγραφούν.`
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
              JSON.stringify({
                name:
                  selectedFolder.name,
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
        throw new Error(
          getErrorMessage(
            json,
            "Αποτυχία διαγραφής φακέλου."
          )
        );
      }

      setSelectedName(
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
      setWorking(
        false
      );
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
              Δημιουργία φακέλων
              και επιλογή των
              χρηστών που θα τους
              έχουν.
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

      {/* CREATE */}
      <section className="rounded-2xl border bg-white p-4">
        <div>
          <h2 className="font-semibold">
            Νέος φάκελος
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Δώστε όνομα και
            επιλέξτε ποιοι χρήστες
            θα έχουν τον φάκελο.
          </p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* NAME */}
          <div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Όνομα φακέλου
              </span>

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
                placeholder="π.χ. ΑΔΕΙΑ ΛΕΙΤΟΥΡΓΙΑΣ"
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </label>

            <div className="mt-4 rounded-xl border bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <Users
                  size={20}
                  className="mt-0.5 text-gray-500"
                />

                <div>
                  <div className="text-sm font-semibold">
                    Επιλεγμένοι
                    χρήστες
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    {
                      newSelectedUserIds.length
                    }
                    {" / "}
                    {
                      totalUsers
                    }{" "}
                    χρήστες
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={
                createFolder
              }
              disabled={
                working ||
                !newName.trim() ||
                newSelectedUserIds.length ===
                  0
              }
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--brand,#25C3F4)] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              <Plus
                size={16}
              />

              Δημιουργία
              φακέλου
            </button>
          </div>

          {/* USERS */}
          <div className="rounded-xl border">
            <div className="border-b p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  Επιλογή
                  χρηστών
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setNewSelectedUserIds(
                        users.map(
                          (user) =>
                            user.id
                        )
                      )
                    }
                    className="text-xs font-medium text-blue-700 hover:underline"
                  >
                    Επιλογή όλων
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setNewSelectedUserIds(
                        []
                      )
                    }
                    className="text-xs font-medium text-gray-500 hover:underline"
                  >
                    Καθαρισμός
                  </button>
                </div>
              </div>

              <input
                value={
                  newUserSearch
                }
                onChange={(
                  event
                ) =>
                  setNewUserSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Αναζήτηση χρήστη..."
                className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
              {filteredNewUsers.length ===
              0 ? (
                <div className="p-3 text-sm text-gray-500">
                  Δεν βρέθηκαν
                  χρήστες.
                </div>
              ) : (
                filteredNewUsers.map(
                  (
                    user
                  ) => (
                    <label
                      key={
                        user.id
                      }
                      className="flex cursor-pointer gap-2 rounded-lg px-2 py-2 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={newSelectedUserIds.includes(
                          user.id
                        )}
                        onChange={() =>
                          setNewSelectedUserIds(
                            (
                              current
                            ) =>
                              toggleId(
                                current,
                                user.id
                              )
                          )
                        }
                        className="mt-1"
                      />

                      <span className="min-w-0 text-sm">
                        <span className="block break-words font-medium">
                          {
                            user.email
                          }
                        </span>

                        <span className="block text-xs text-gray-500">
                          {user.name ||
                            "—"}

                          {user.status
                            ? ` • ${user.status}`
                            : ""}
                        </span>
                      </span>
                    </label>
                  )
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <div className="grid min-h-[620px] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* FOLDER LIST */}
        <section className="overflow-hidden rounded-2xl border bg-white">
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
              placeholder="Αναζήτηση φακέλου..."
              className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>

          <div className="max-h-[650px] overflow-y-auto p-2">
            {loading ? (
              <div className="p-3 text-sm text-gray-500">
                Φόρτωση...
              </div>
            ) : filteredFolders.length ===
              0 ? (
              <div className="p-3 text-sm text-gray-500">
                Δεν βρέθηκαν
                φάκελοι.
              </div>
            ) : (
              filteredFolders.map(
                (
                  folder
                ) => (
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
                    className={[
                      "mb-1 flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left",

                      selectedName ===
                      folder.name
                        ? "border-[color:var(--brand,#25C3F4)] bg-cyan-50"
                        : "border-transparent hover:bg-gray-50",
                    ].join(
                      " "
                    )}
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

                      <span className="mt-1 block text-xs text-gray-500">
                        {
                          folder.count
                        }
                        {" / "}
                        {
                          folder.totalUsers
                        }{" "}
                        χρήστες
                      </span>
                    </div>
                  </button>
                )
              )
            )}
          </div>
        </section>

        {/* DETAILS */}
        <section className="rounded-2xl border bg-white p-4">
          {!selectedFolder ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500">
              Επιλέξτε
              φάκελο.
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
                      Ο φάκελος
                      υπάρχει σε{" "}
                      <strong>
                        {
                          selectedFolder.count
                        }
                      </strong>
                      {" / "}
                      {
                        selectedFolder.totalUsers
                      }{" "}
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

              {/* STATUS */}
              <div
                className={[
                  "rounded-xl border p-4",

                  selectedFolder.complete
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-amber-50",
                ].join(
                  " "
                )}
              >
                <div className="flex items-start gap-3">
                  {selectedFolder.complete ? (
                    <CheckCircle2
                      size={20}
                      className="mt-0.5 text-emerald-700"
                    />
                  ) : (
                    <AlertTriangle
                      size={20}
                      className="mt-0.5 text-amber-700"
                    />
                  )}

                  <div>
                    <div className="font-semibold">
                      {selectedFolder.complete
                        ? "Ο φάκελος υπάρχει σε όλους τους χρήστες"
                        : `Ο φάκελος υπάρχει σε ${selectedFolder.count} από ${selectedFolder.totalUsers} χρήστες`}
                    </div>

                    <p className="mt-1 text-sm opacity-80">
                      Μπορείτε να
                      αλλάξετε τους
                      χρήστες από
                      την παρακάτω
                      λίστα.
                    </p>
                  </div>
                </div>
              </div>

              {/* MEMBERS */}
              <div className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      Χρήστες
                      φακέλου
                    </h3>

                    <p className="mt-1 text-xs text-gray-500">
                      Τικάρετε ακριβώς
                      τους χρήστες που
                      πρέπει να έχουν
                      αυτόν τον
                      φάκελο.
                    </p>
                  </div>

                  <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                    {
                      memberSelections.length
                    }
                    {" / "}
                    {
                      totalUsers
                    }
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setMemberSelections(
                        users.map(
                          (user) =>
                            user.id
                        )
                      )
                    }
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                  >
                    Επιλογή όλων
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setMemberSelections(
                        []
                      )
                    }
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                  >
                    Καθαρισμός
                  </button>
                </div>

                <input
                  value={
                    memberSearch
                  }
                  onChange={(
                    event
                  ) =>
                    setMemberSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Αναζήτηση χρήστη..."
                  className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
                />

                <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border bg-gray-50 p-2">
                  {filteredMemberUsers.map(
                    (
                      user
                    ) => (
                      <label
                        key={
                          user.id
                        }
                        className="flex cursor-pointer gap-2 rounded-lg px-2 py-2 hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={memberSelections.includes(
                            user.id
                          )}
                          onChange={() =>
                            setMemberSelections(
                              (
                                current
                              ) =>
                                toggleId(
                                  current,
                                  user.id
                                )
                            )
                          }
                          className="mt-1"
                        />

                        <span className="min-w-0 text-sm">
                          <span className="block break-words font-medium">
                            {
                              user.email
                            }
                          </span>

                          <span className="block text-xs text-gray-500">
                            {user.name ||
                              "—"}

                            {user.status
                              ? ` • ${user.status}`
                              : ""}
                          </span>
                        </span>
                      </label>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={
                    saveMembership
                  }
                  disabled={
                    working
                  }
                  className="mt-3 inline-flex items-center justify-center rounded-xl bg-[color:var(--brand,#25C3F4)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                >
                  Αποθήκευση
                  χρηστών
                </button>
              </div>

              {/* RENAME */}
              <div className="rounded-xl border p-4">
                <h3 className="font-semibold">
                  Μετονομασία
                  φακέλου
                </h3>

                <p className="mt-1 text-xs text-gray-500">
                  Θα μετονομαστεί
                  μόνο για τους
                  χρήστες που έχουν
                  ήδη τον φάκελο.
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
            </div>
          )}
        </section>
      </div>
    </div>
  );
}