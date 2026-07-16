"use client";

import { useEffect, useMemo, useState } from "react";

type AssignedUser = {
  id: string;
  email: string;
  name?: string | null;
};

type FileRow = {
  id: string;
  title: string;
  createdAt: string;
  url?: string | null;
  originalName?: string | null;
  assignments?: {
    user: AssignedUser;
  }[];
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  status?: string;
  role?: string;
};

export default function AdminFilesPage() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual upload.
  const [newTitle, setNewTitle] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newSelectedUserIds, setNewSelectedUserIds] = useState<string[]>([]);
  const [newUserSearch, setNewUserSearch] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // Search files.
  // fileSearchInput = what the administrator is currently typing.
  // fileSearch = the search that has actually been applied.
  const [fileSearchInput, setFileSearchInput] = useState("");
  const [fileSearch, setFileSearch] = useState("");

  // Per-file assignment selections.
  const [assignmentSelections, setAssignmentSelections] = useState<
    Record<string, string[]>
  >({});

  // Per-file deletion/unassignment selections.
  const [removalSelections, setRemovalSelections] = useState<
    Record<string, string[]>
  >({});

  const [workingFileId, setWorkingFileId] = useState<string | null>(null);

  // Existing cleanup functions.
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [checkingMissing, setCheckingMissing] = useState(false);
  const [cleaningMissing, setCleaningMissing] = useState(false);

  async function load() {
    setLoading(true);

    try {
      const [filesResponse, usersResponse] = await Promise.all([
        fetch("/api/files?scope=all", {
          cache: "no-store",
        }),
        fetch("/api/admin/users", {
          cache: "no-store",
        }),
      ]);

      if (filesResponse.ok) {
        const json = await filesResponse.json();
        setFiles(json.files || []);
      }

      if (usersResponse.ok) {
        const json = await usersResponse.json();
        setUsers(json.users || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.status === "ACTIVE" &&
          user.role !== "ADMIN"
      ),
    [users]
  );

  const filteredUploadUsers = useMemo(() => {
    const query = newUserSearch.trim().toLowerCase();

    if (!query) return activeUsers;

    return activeUsers.filter((user) => {
      const email = user.email.toLowerCase();
      const name = (user.name || "").toLowerCase();

      return email.includes(query) || name.includes(query);
    });
  }, [activeUsers, newUserSearch]);

  const filteredFiles = useMemo(() => {
    const query = fileSearch.trim().toLowerCase();

    if (!query) return files;

    return files.filter((file) => {
      const title = (file.title || "").toLowerCase();
      const originalName = (file.originalName || "").toLowerCase();

      const assignedText = (file.assignments || [])
        .map(
          (assignment) =>
            `${assignment.user.email} ${assignment.user.name || ""}`
        )
        .join(" ")
        .toLowerCase();

      return (
        title.includes(query) ||
        originalName.includes(query) ||
        assignedText.includes(query)
      );
    });
  }, [files, fileSearch]);

  function applyFileSearch() {
    setFileSearch(fileSearchInput.trim());
  }

  function clearFileSearch() {
    setFileSearchInput("");
    setFileSearch("");
  }

  function toggleId(
    current: string[],
    id: string
  ): string[] {
    return current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
  }

  function toggleAllUploadUsers() {
    const allIds = activeUsers.map((user) => user.id);

    const allSelected =
      allIds.length > 0 &&
      allIds.every((id) => newSelectedUserIds.includes(id));

    setNewSelectedUserIds(
      allSelected ? [] : allIds
    );
  }

  async function createManual() {
    if (!newTitle.trim() || !newFile) {
      alert("Συμπληρώστε τίτλο και επιλέξτε αρχείο.");
      return;
    }

    setSavingNew(true);

    try {
      const formData = new FormData();

      formData.append("title", newTitle.trim());
      formData.append("file", newFile);

      if (newSelectedUserIds.length > 0) {
        formData.append(
          "assignTo",
          JSON.stringify(newSelectedUserIds)
        );
      }

      const response = await fetch("/api/files", {
        method: "POST",
        body: formData,
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία δημιουργίας αρχείου"
        );
      }

      setNewTitle("");
      setNewFile(null);
      setNewSelectedUserIds([]);
      setNewUserSearch("");

      const input = document.getElementById(
        "admin-manual-file-input"
      ) as HTMLInputElement | null;

      if (input) input.value = "";

      await load();
    } catch (error: any) {
      alert(error?.message || "Σφάλμα");
    } finally {
      setSavingNew(false);
    }
  }

  async function assignSelected(fileId: string) {
    const userIds = assignmentSelections[fileId] || [];

    if (userIds.length === 0) {
      alert("Επιλέξτε τουλάχιστον έναν χρήστη.");
      return;
    }

    setWorkingFileId(fileId);

    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId,
          userIds,
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία ανάθεσης"
        );
      }

      setAssignmentSelections((previous) => ({
        ...previous,
        [fileId]: [],
      }));

      await load();
    } catch (error: any) {
      alert(error?.message || "Αποτυχία ανάθεσης");
    } finally {
      setWorkingFileId(null);
    }
  }

  async function assignToAll(fileId: string) {
    if (
      !confirm(
        "Να ανατεθεί το αρχείο σε όλους τους ενεργούς χρήστες;"
      )
    ) {
      return;
    }

    setWorkingFileId(fileId);

    try {
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId,
          all: true,
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία ανάθεσης"
        );
      }

      await load();
    } catch (error: any) {
      alert(error?.message || "Αποτυχία ανάθεσης");
    } finally {
      setWorkingFileId(null);
    }
  }

  async function removeSelectedAssignments(fileId: string) {
    const userIds = removalSelections[fileId] || [];

    if (userIds.length === 0) {
      alert(
        "Επιλέξτε τουλάχιστον έναν χρήστη από τον οποίο θα αφαιρεθεί το αρχείο."
      );
      return;
    }

    if (
      !confirm(
        `Να αφαιρεθεί το αρχείο από ${userIds.length} χρήστη/χρήστες;`
      )
    ) {
      return;
    }

    setWorkingFileId(fileId);

    try {
      const response = await fetch(
        `/api/admin/files/${fileId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userIds,
            deleteEntireFile: false,
          }),
        }
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία αφαίρεσης αναθέσεων"
        );
      }

      setRemovalSelections((previous) => ({
        ...previous,
        [fileId]: [],
      }));

      await load();
    } catch (error: any) {
      alert(
        error?.message ||
          "Αποτυχία αφαίρεσης αναθέσεων"
      );
    } finally {
      setWorkingFileId(null);
    }
  }

  async function deleteEntireFile(fileId: string) {
    if (
      !confirm(
        "Να διαγραφεί οριστικά το αρχείο;\n\nΘα αφαιρεθεί από όλους τους χρήστες, από τη βάση και από το Supabase Storage."
      )
    ) {
      return;
    }

    setWorkingFileId(fileId);

    try {
      const response = await fetch(
        `/api/admin/files/${fileId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deleteEntireFile: true,
          }),
        }
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία διαγραφής αρχείου"
        );
      }

      setFiles((previous) =>
        previous.filter((file) => file.id !== fileId)
      );
    } catch (error: any) {
      alert(
        error?.message ||
          "Αποτυχία διαγραφής αρχείου"
      );
    } finally {
      setWorkingFileId(null);
    }
  }

  async function cleanupDuplicates() {
    if (
      !confirm(
        "Να γίνει έλεγχος duplicates και διαγραφή του παλαιότερου duplicate αρχείου;"
      )
    ) {
      return;
    }

    setCleaningDuplicates(true);

    try {
      const response = await fetch(
        "/api/admin/files/cleanup-duplicates",
        {
          method: "POST",
        }
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Αποτυχία καθαρισμού duplicates"
        );
      }

      alert(
        `Ο έλεγχος ολοκληρώθηκε.\nΒρέθηκαν groups: ${
          json.groupsFound ?? 0
        }\nΔιαγράφηκαν αρχεία: ${
          json.deletedFiles ?? 0
        }`
      );

      await load();
    } catch (error: any) {
      alert(
        error?.message ||
          "Σφάλμα κατά τον έλεγχο duplicates"
      );
    } finally {
      setCleaningDuplicates(false);
    }
  }

  async function checkMissingStorage() {
    setCheckingMissing(true);

    try {
      const response = await fetch(
        "/api/admin/files/check-missing-storage",
        {
          cache: "no-store",
        }
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία ελέγχου storage"
        );
      }

      console.log("Missing storage report:", json);

      if (!json.missingCount) {
        alert(
          `Ο έλεγχος ολοκληρώθηκε.\nΔεν βρέθηκαν missing αρχεία.\nΣύνολο checked: ${json.totalChecked}`
        );
      } else {
        alert(
          `Ο έλεγχος ολοκληρώθηκε.\nΣύνολο checked: ${json.totalChecked}\nMissing αρχεία: ${json.missingCount}\n\nΆνοιξε Console για αναλυτική λίστα.`
        );
      }
    } catch (error: any) {
      alert(
        error?.message ||
          "Σφάλμα κατά τον έλεγχο storage"
      );
    } finally {
      setCheckingMissing(false);
    }
  }

  async function cleanupMissingStorage() {
    if (
      !confirm(
        "Να διαγραφούν από τη βάση όλα τα αρχεία που λείπουν από το Supabase Storage;\n\nΘα διαγραφούν και οι αναθέσεις τους."
      )
    ) {
      return;
    }

    setCleaningMissing(true);

    try {
      const response = await fetch(
        "/api/admin/files/cleanup-missing-storage",
        {
          method: "POST",
        }
      );

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία cleanup missing files"
        );
      }

      alert(
        `Ο καθαρισμός ολοκληρώθηκε.\nMissing found: ${
          json.missingFound ?? 0
        }\nDeleted files: ${
          json.deletedFiles ?? 0
        }\nDeleted assignments: ${
          json.deletedAssignments ?? 0
        }`
      );

      await load();
    } catch (error: any) {
      alert(
        error?.message ||
          "Σφάλμα κατά τον καθαρισμό broken files"
      );
    } finally {
      setCleaningMissing(false);
    }
  }

  return (
    <div className="grid gap-4 text-[inherit]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          Όλα τα αρχεία
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={checkMissingStorage}
            disabled={checkingMissing}
            className="rounded border px-3 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-60"
          >
            {checkingMissing
              ? "Έλεγχος storage…"
              : "Έλεγχος missing storage"}
          </button>

          <button
            type="button"
            onClick={cleanupMissingStorage}
            disabled={cleaningMissing}
            className="rounded border px-3 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-60"
          >
            {cleaningMissing
              ? "Καθαρισμός broken…"
              : "Καθαρισμός broken files"}
          </button>

          <button
            type="button"
            onClick={cleanupDuplicates}
            disabled={cleaningDuplicates}
            className="rounded border px-3 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-60"
          >
            {cleaningDuplicates
              ? "Έλεγχος duplicates…"
              : "Έλεγχος duplicates"}
          </button>
        </div>
      </div>

      {/* Manual upload */}
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4">
        <h3 className="font-medium">
          Προσθήκη αρχείου χειροκίνητα
        </h3>

        <div className="mt-3 grid gap-3">
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Τίτλος"
            value={newTitle}
            onChange={(event) =>
              setNewTitle(event.target.value)
            }
          />

          <input
            id="admin-manual-file-input"
            type="file"
            className="w-full rounded border bg-white px-3 py-2 text-sm"
            onChange={(event) => {
              const selectedFile =
                event.currentTarget.files?.[0] || null;

              setNewFile(selectedFile);

              if (selectedFile && !newTitle.trim()) {
                setNewTitle(
                  selectedFile.name.replace(/\.[^/.]+$/, "")
                );
              }
            }}
          />

          <UserChecklist
            users={filteredUploadUsers}
            selectedIds={newSelectedUserIds}
            onToggle={(userId) =>
              setNewSelectedUserIds((previous) =>
                toggleId(previous, userId)
              )
            }
            search={newUserSearch}
            onSearch={setNewUserSearch}
            showAll
            allChecked={
              activeUsers.length > 0 &&
              activeUsers.every((user) =>
                newSelectedUserIds.includes(user.id)
              )
            }
            onToggleAll={toggleAllUploadUsers}
          />

          <button
            type="button"
            disabled={savingNew}
            onClick={createManual}
            className="rounded bg-[color:var(--brand,#25C3F4)] px-4 py-2 font-medium text-black hover:opacity-90 disabled:opacity-60"
          >
            {savingNew
              ? "Αποθήκευση…"
              : `Προσθήκη${
                  newSelectedUserIds.length
                    ? ` και ανάθεση σε ${newSelectedUserIds.length}`
                    : ""
                }`}
          </button>
        </div>
      </section>

      {/* File search */}
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyFileSearch();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              Αναζήτηση αρχείου
            </span>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={fileSearchInput}
                onChange={(event) =>
                  setFileSearchInput(event.target.value)
                }
                placeholder="Τίτλος, όνομα αρχείου, email ή όνομα χρήστη…"
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />

              <button
                type="submit"
                className="shrink-0 rounded-xl bg-[color:var(--brand,#25C3F4)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
              >
                Αναζήτηση
              </button>

              <button
                type="button"
                onClick={clearFileSearch}
                disabled={!fileSearchInput && !fileSearch}
                className="shrink-0 rounded-xl border px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
              >
                Καθαρισμός
              </button>
            </div>
          </label>
        </form>

        <div className="mt-2 text-xs text-gray-500">
          {filteredFiles.length} από {files.length} αρχεία
        </div>
      </section>

      {loading ? (
        <div className="text-sm text-[color:var(--muted)]">
          Φόρτωση…
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="rounded-2xl border p-4 text-sm text-gray-500">
          Δεν βρέθηκαν αρχεία.
        </div>
      ) : (
        <section className="grid gap-4">
          {filteredFiles.map((file) => {
            const assignedUsers = (
              file.assignments || []
            ).map((assignment) => assignment.user);

            const assignedUserIds =
              assignedUsers.map((user) => user.id);

            const assignableUsers =
              activeUsers.filter(
                (user) =>
                  !assignedUserIds.includes(user.id)
              );

            const assigning =
              assignmentSelections[file.id] || [];

            const removing =
              removalSelections[file.id] || [];

            const isWorking =
              workingFileId === file.id;

            return (
              <article
                key={file.id}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold break-words">
                      {file.title}
                    </h3>

                    {file.originalName && (
                      <div className="mt-1 text-xs text-gray-500 break-words">
                        {file.originalName}
                      </div>
                    )}

                    <div className="mt-1 text-xs text-gray-500">
                      {new Date(
                        file.createdAt
                      ).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {file.url && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border px-3 py-2 text-sm hover:bg-black/5"
                      >
                        Λήψη
                      </a>
                    )}

                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() =>
                        deleteEntireFile(file.id)
                      }
                      className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {isWorking
                        ? "Επεξεργασία…"
                        : "Οριστική διαγραφή"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {/* Assign users */}
                  <section className="rounded-xl border p-3">
                    <h4 className="text-sm font-semibold">
                      Πρόσθετη ανάθεση
                    </h4>

                    <p className="mt-1 text-xs text-gray-500">
                      Επιλέξτε έναν ή περισσότερους
                      χρήστες που δεν έχουν ήδη το
                      αρχείο.
                    </p>

                    <div className="mt-3">
                      <UserChecklist
                        users={assignableUsers}
                        selectedIds={assigning}
                        onToggle={(userId) =>
                          setAssignmentSelections(
                            (previous) => ({
                              ...previous,
                              [file.id]: toggleId(
                                previous[file.id] || [],
                                userId
                              ),
                            })
                          )
                        }
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          isWorking ||
                          assigning.length === 0
                        }
                        onClick={() =>
                          assignSelected(file.id)
                        }
                        className="rounded bg-[color:var(--brand,#25C3F4)] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
                      >
                        Ανάθεση επιλεγμένων
                      </button>

                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() =>
                          assignToAll(file.id)
                        }
                        className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
                      >
                        Ανάθεση σε όλους
                      </button>
                    </div>
                  </section>

                  {/* Remove assignments */}
                  <section className="rounded-xl border p-3">
                    <h4 className="text-sm font-semibold">
                      Ανατεθειμένο σε
                    </h4>

                    <p className="mt-1 text-xs text-gray-500">
                      Επιλέξτε τους χρήστες από τους
                      οποίους θέλετε να αφαιρεθεί το
                      αρχείο.
                    </p>

                    <div className="mt-3">
                      <UserChecklist
                        users={assignedUsers}
                        selectedIds={removing}
                        onToggle={(userId) =>
                          setRemovalSelections(
                            (previous) => ({
                              ...previous,
                              [file.id]: toggleId(
                                previous[file.id] || [],
                                userId
                              ),
                            })
                          )
                        }
                        emptyMessage="Το αρχείο δεν έχει ανατεθεί σε κάποιον χρήστη."
                      />
                    </div>

                    <button
                      type="button"
                      disabled={
                        isWorking ||
                        removing.length === 0
                      }
                      onClick={() =>
                        removeSelectedAssignments(
                          file.id
                        )
                      }
                      className="mt-3 rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Αφαίρεση από επιλεγμένους
                    </button>
                  </section>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function UserChecklist({
  users,
  selectedIds,
  onToggle,
  search,
  onSearch,
  showAll = false,
  allChecked = false,
  onToggleAll,
  emptyMessage = "Δεν υπάρχουν διαθέσιμοι χρήστες.",
}: {
  users: AssignedUser[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
  search?: string;
  onSearch?: (value: string) => void;
  showAll?: boolean;
  allChecked?: boolean;
  onToggleAll?: () => void;
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-xl border bg-gray-50 p-2">
      {onSearch && (
        <input
          value={search || ""}
          onChange={(event) =>
            onSearch(event.target.value)
          }
          placeholder="Αναζήτηση χρήστη…"
          className="mb-2 w-full rounded-lg border bg-white px-3 py-2 text-sm"
        />
      )}

      <div className="max-h-56 overflow-y-auto">
        {showAll && onToggleAll && (
          <>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-white">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={onToggleAll}
                className="mt-0.5"
              />

              <span className="text-sm font-semibold">
                Όλοι οι ενεργοί χρήστες
              </span>
            </label>

            <div className="my-1 h-px bg-gray-200" />
          </>
        )}

        {users.length === 0 ? (
          <div className="px-2 py-3 text-sm text-gray-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="grid gap-1">
            {users.map((user) => (
              <label
                key={user.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-white"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(
                    user.id
                  )}
                  onChange={() =>
                    onToggle(user.id)
                  }
                  className="mt-0.5"
                />

                <span className="min-w-0 text-sm">
                  <span className="block break-words">
                    {user.email}
                  </span>

                  {user.name && (
                    <span className="block text-xs text-gray-500 break-words">
                      {user.name}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}