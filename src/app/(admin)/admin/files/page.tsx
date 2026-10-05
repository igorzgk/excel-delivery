// src/app/(admin)/admin/files/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

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
  mime?: string | null;
  size?: number | null;
  pdfFolderId?: string | null;
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

type FolderRow = {
  id: string;
  name: string;
};

type FileTab = "EXCEL" | "PDF" | "OTHER";
type AssignmentMode = "SELECTED" | "ALL";

function filenameWithoutExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

function cleanUploadedFilename(name: string) {
  const withoutExtension = filenameWithoutExtension(name);

  return withoutExtension.replace(
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}__?/i,
    ""
  );
}

function isPdfFile(file: FileRow) {
  const name = (
    file.originalName ||
    file.title ||
    ""
  ).toLowerCase();

  const mime = (file.mime || "").toLowerCase();

  return (
    mime.includes("pdf") ||
    name.endsWith(".pdf")
  );
}

function isExcelFile(file: FileRow) {
  const name = (
    file.originalName ||
    file.title ||
    ""
  ).toLowerCase();

  const mime = (file.mime || "").toLowerCase();

  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  );
}

function formatSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;

  while (
    value >= 1024 &&
    index < units.length - 1
  ) {
    value /= 1024;
    index++;
  }

  return `${value.toFixed(
    value < 10 && index > 0 ? 1 : 0
  )} ${units[index]}`;
}

export default function AdminFilesPage() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Main explorer state
  const [activeTab, setActiveTab] =
    useState<FileTab>("EXCEL");

  const [currentFolderId, setCurrentFolderId] =
    useState<string | null>(null);

  const [query, setQuery] = useState("");

  // Manual upload
  const [newTitle, setNewTitle] = useState("");
  const [newFile, setNewFile] =
    useState<File | null>(null);

  const [newPdfFolderId, setNewPdfFolderId] =
    useState("");

  const [assignmentMode, setAssignmentMode] =
    useState<AssignmentMode>("SELECTED");

  const [
    newSelectedUserIds,
    setNewSelectedUserIds,
  ] = useState<string[]>([]);

  const [newUserSearch, setNewUserSearch] =
    useState("");

  const [savingNew, setSavingNew] =
    useState(false);

  // Manage assignments modal
  const [manageFileId, setManageFileId] =
    useState<string | null>(null);

  const [
    assignmentSelections,
    setAssignmentSelections,
  ] = useState<Record<string, string[]>>({});

  const [
    removalSelections,
    setRemovalSelections,
  ] = useState<Record<string, string[]>>({});

  const [workingFileId, setWorkingFileId] =
    useState<string | null>(null);

  // PDF move menu
  const [moveMenuFileId, setMoveMenuFileId] =
    useState<string | null>(null);

  // Maintenance
  const [
    cleaningDuplicates,
    setCleaningDuplicates,
  ] = useState(false);

  const [
    checkingMissing,
    setCheckingMissing,
  ] = useState(false);

  const [
    cleaningMissing,
    setCleaningMissing,
  ] = useState(false);

  async function load() {
    setLoading(true);

    try {
      const [
        filesResponse,
        usersResponse,
        foldersResponse,
      ] = await Promise.all([
        fetch("/api/files?scope=all", {
          cache: "no-store",
        }),

        fetch("/api/admin/users", {
          cache: "no-store",
        }),

        fetch("/api/pdf-folders", {
          cache: "no-store",
        }),
      ]);

      if (filesResponse.ok) {
        const json =
          await filesResponse.json();

        setFiles(json.files || []);
      }

      if (usersResponse.ok) {
        const json =
          await usersResponse.json();

        setUsers(json.users || []);
      }

      if (foldersResponse.ok) {
        const json =
          await foldersResponse.json();

        setFolders(json.folders || []);
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
    const q =
      newUserSearch.trim().toLowerCase();

    if (!q) return activeUsers;

    return activeUsers.filter((user) => {
      const email =
        user.email.toLowerCase();

      const name = (
        user.name || ""
      ).toLowerCase();

      return (
        email.includes(q) ||
        name.includes(q)
      );
    });
  }, [activeUsers, newUserSearch]);

  const selectedFileIsPdf =
    !!newFile &&
    (newFile.type === "application/pdf" ||
      newFile.name
        .toLowerCase()
        .endsWith(".pdf"));

  const excelFiles = useMemo(
    () => files.filter(isExcelFile),
    [files]
  );

  const pdfFiles = useMemo(
    () => files.filter(isPdfFile),
    [files]
  );

  const otherFiles = useMemo(
    () =>
      files.filter(
        (file) =>
          !isExcelFile(file) &&
          !isPdfFile(file)
      ),
    [files]
  );

  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;

    return (
      folders.find(
        (folder) =>
          folder.id === currentFolderId
      ) || null
    );
  }, [folders, currentFolderId]);

  const visibleFiles = useMemo(() => {
    const q = query.trim().toLowerCase();

    let source: FileRow[] = [];

    if (activeTab === "EXCEL") {
      source = excelFiles;
    } else if (activeTab === "OTHER") {
      source = otherFiles;
    } else {
      source = currentFolderId
        ? pdfFiles.filter(
            (file) =>
              file.pdfFolderId ===
              currentFolderId
          )
        : pdfFiles.filter(
            (file) =>
              !file.pdfFolderId
          );
    }

    if (!q) return source;

    return source.filter((file) => {
      const title = (
        file.title || ""
      ).toLowerCase();

      const originalName = (
        file.originalName || ""
      ).toLowerCase();

      const assignedText = (
        file.assignments || []
      )
        .map(
          (assignment) =>
            `${assignment.user.email} ${
              assignment.user.name || ""
            }`
        )
        .join(" ")
        .toLowerCase();

      return (
        title.includes(q) ||
        originalName.includes(q) ||
        assignedText.includes(q)
      );
    });
  }, [
    activeTab,
    excelFiles,
    pdfFiles,
    otherFiles,
    currentFolderId,
    query,
  ]);

  const visibleFolders = useMemo(() => {
    if (
      activeTab !== "PDF" ||
      currentFolderId
    ) {
      return [];
    }

    const q = query.trim().toLowerCase();

    if (!q) return folders;

    return folders.filter((folder) =>
      folder.name
        .toLowerCase()
        .includes(q)
    );
  }, [
    activeTab,
    currentFolderId,
    folders,
    query,
  ]);

  const managingFile = useMemo(
    () =>
      files.find(
        (file) =>
          file.id === manageFileId
      ) || null,
    [files, manageFileId]
  );

  function toggleId(
    current: string[],
    id: string
  ) {
    return current.includes(id)
      ? current.filter(
          (item) => item !== id
        )
      : [...current, id];
  }

  function changeTab(tab: FileTab) {
    setActiveTab(tab);
    setCurrentFolderId(null);
    setMoveMenuFileId(null);
    setQuery("");
  }

  async function createManual() {
    if (
      !newTitle.trim() ||
      !newFile
    ) {
      alert(
        "Συμπληρώστε τίτλο και επιλέξτε αρχείο."
      );
      return;
    }

    setSavingNew(true);

    try {
      const formData = new FormData();

      formData.append(
        "title",
        newTitle.trim()
      );

      formData.append(
        "file",
        newFile
      );

      if (
        assignmentMode === "ALL"
      ) {
        formData.append(
          "assignTo",
          "ALL"
        );
      } else if (
        newSelectedUserIds.length > 0
      ) {
        formData.append(
          "assignTo",
          JSON.stringify(
            newSelectedUserIds
          )
        );
      }

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
            "Αποτυχία δημιουργίας αρχείου"
        );
      }

      const createdFileId =
        json?.file?.id || json?.id;

      if (
        selectedFileIsPdf &&
        newPdfFolderId &&
        createdFileId
      ) {
        const moveResponse =
          await fetch(
            `/api/files/${createdFileId}/pdf-folder`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                pdfFolderId:
                  newPdfFolderId,
              }),
            }
          );

        if (!moveResponse.ok) {
          alert(
            "Το αρχείο ανέβηκε, αλλά δεν μπόρεσε να τοποθετηθεί στον επιλεγμένο φάκελο."
          );
        }
      }

      setNewTitle("");
      setNewFile(null);
      setNewPdfFolderId("");
      setNewSelectedUserIds([]);
      setNewUserSearch("");
      setAssignmentMode("SELECTED");

      const input =
        document.getElementById(
          "admin-manual-file-input"
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await load();
    } catch (error: any) {
      alert(
        error?.message || "Σφάλμα"
      );
    } finally {
      setSavingNew(false);
    }
  }

  async function assignSelected(
    fileId: string
  ) {
    const userIds =
      assignmentSelections[fileId] ||
      [];

    if (userIds.length === 0) {
      alert(
        "Επιλέξτε τουλάχιστον έναν χρήστη."
      );
      return;
    }

    setWorkingFileId(fileId);

    try {
      const response = await fetch(
        "/api/assignments",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            fileId,
            userIds,
          }),
        }
      );

      const json = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία ανάθεσης"
        );
      }

      setAssignmentSelections(
        (previous) => ({
          ...previous,
          [fileId]: [],
        })
      );

      await load();
    } catch (error: any) {
      alert(
        error?.message ||
          "Αποτυχία ανάθεσης"
      );
    } finally {
      setWorkingFileId(null);
    }
  }

  async function assignToAll(
    fileId: string
  ) {
    if (
      !confirm(
        "Να ανατεθεί το αρχείο σε όλους τους ενεργούς χρήστες;"
      )
    ) {
      return;
    }

    setWorkingFileId(fileId);

    try {
      const response = await fetch(
        "/api/assignments",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            fileId,
            all: true,
          }),
        }
      );

      const json = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία ανάθεσης"
        );
      }

      await load();
    } catch (error: any) {
      alert(
        error?.message ||
          "Αποτυχία ανάθεσης"
      );
    } finally {
      setWorkingFileId(null);
    }
  }

  async function removeSelectedAssignments(
    fileId: string
  ) {
    const userIds =
      removalSelections[fileId] || [];

    if (userIds.length === 0) {
      alert(
        "Επιλέξτε τουλάχιστον έναν χρήστη."
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
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            userIds,
            deleteEntireFile: false,
          }),
        }
      );

      const json = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία αφαίρεσης αναθέσεων"
        );
      }

      setRemovalSelections(
        (previous) => ({
          ...previous,
          [fileId]: [],
        })
      );

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

  async function deleteEntireFile(
    fileId: string
  ) {
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
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            deleteEntireFile: true,
          }),
        }
      );

      const json = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία διαγραφής αρχείου"
        );
      }

      setFiles((previous) =>
        previous.filter(
          (file) =>
            file.id !== fileId
        )
      );

      if (
        manageFileId === fileId
      ) {
        setManageFileId(null);
      }
    } catch (error: any) {
      alert(
        error?.message ||
          "Αποτυχία διαγραφής αρχείου"
      );
    } finally {
      setWorkingFileId(null);
    }
  }

  async function movePdf(
    fileId: string,
    folderId: string | null
  ) {
    const response = await fetch(
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

    if (!response.ok) {
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

    setMoveMenuFileId(null);
  }

  async function createFolder() {
    const name = prompt(
      "Όνομα νέου φακέλου:"
    )?.trim();

    if (!name) return;

    const response = await fetch(
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

    const json = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      alert(
        json?.error ===
          "folder_exists"
          ? "Ο φάκελος υπάρχει ήδη."
          : "Αποτυχία δημιουργίας φακέλου."
      );
      return;
    }

    await load();
  }

  async function renameFolder(
    id: string,
    current: string
  ) {
    const name = prompt(
      "Νέο όνομα φακέλου:",
      current
    )?.trim();

    if (
      !name ||
      name === current
    ) {
      return;
    }

    const response = await fetch(
      `/api/pdf-folders/${id}`,
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

    if (!response.ok) {
      alert(
        "Αποτυχία μετονομασίας."
      );
      return;
    }

    await load();
  }

  async function deleteFolder(
    id: string
  ) {
    if (
      !confirm(
        "Διαγραφή φακέλου;\n\nΤα PDF δεν θα διαγραφούν. Θα μεταφερθούν στη βασική προβολή."
      )
    ) {
      return;
    }

    const response = await fetch(
      `/api/pdf-folders/${id}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      alert(
        "Αποτυχία διαγραφής φακέλου."
      );
      return;
    }

    setFiles((previous) =>
      previous.map((file) =>
        file.pdfFolderId === id
          ? {
              ...file,
              pdfFolderId: null,
            }
          : file
      )
    );

    if (
      currentFolderId === id
    ) {
      setCurrentFolderId(null);
    }

    await load();
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

      const json = await response
        .json()
        .catch(() => ({}));

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

      const json = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία ελέγχου storage"
        );
      }

      console.log(
        "Missing storage report:",
        json
      );

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

      const json = await response
        .json()
        .catch(() => ({}));

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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">
          Διαχείριση αρχείων
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Ανέβασμα, ανάθεση και
          οργάνωση αρχείων χρηστών.
        </p>
      </div>

      {/* Upload */}
      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold">
            Προσθήκη νέου αρχείου
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Επιλέξτε αρχείο, χρήστες
            και — για PDF — φάκελο
            τεκμηρίωσης.
          </p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Τίτλος
              </span>

              <input
                value={newTitle}
                onChange={(event) =>
                  setNewTitle(
                    event.target.value
                  )
                }
                placeholder="Τίτλος αρχείου"
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Αρχείο
              </span>

              <input
                id="admin-manual-file-input"
                type="file"
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                onChange={(event) => {
                  const selectedFile =
                    event.currentTarget
                      .files?.[0] ||
                    null;

                  setNewFile(
                    selectedFile
                  );

                  setNewPdfFolderId("");

                  if (
                    selectedFile &&
                    !newTitle.trim()
                  ) {
                    setNewTitle(
                      cleanUploadedFilename(
                        selectedFile.name
                      )
                    );
                  }
                }}
              />
            </label>

            {selectedFileIsPdf && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  Φάκελος τεκμηρίωσης
                </span>

                <select
                  value={
                    newPdfFolderId
                  }
                  onChange={(event) =>
                    setNewPdfFolderId(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">
                    Χωρίς φάκελο
                  </option>

                  {folders.map(
                    (folder) => (
                      <option
                        key={
                          folder.id
                        }
                        value={
                          folder.id
                        }
                      >
                        {
                          folder.name
                        }
                      </option>
                    )
                  )}
                </select>

                <p className="mt-1 text-xs text-gray-500">
                  Ο ίδιος φάκελος θα
                  ισχύει για όλους
                  τους χρήστες στους
                  οποίους ανατίθεται
                  το PDF.
                </p>
              </label>
            )}
          </div>

          {/* Assignment */}
          <div className="rounded-xl border bg-gray-50 p-4">
            <h3 className="font-semibold">
              Ανάθεση αρχείου
            </h3>

            <div className="mt-3 grid gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2.5">
                <input
                  type="radio"
                  name="assignment-mode"
                  checked={
                    assignmentMode ===
                    "SELECTED"
                  }
                  onChange={() =>
                    setAssignmentMode(
                      "SELECTED"
                    )
                  }
                />

                <span className="text-sm font-medium">
                  Σε συγκεκριμένους
                  χρήστες
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2.5">
                <input
                  type="radio"
                  name="assignment-mode"
                  checked={
                    assignmentMode ===
                    "ALL"
                  }
                  onChange={() =>
                    setAssignmentMode(
                      "ALL"
                    )
                  }
                />

                <span className="text-sm font-medium">
                  Σε όλους τους ενεργούς
                  χρήστες
                </span>
              </label>
            </div>

            {assignmentMode ===
              "SELECTED" && (
              <div className="mt-3">
                <input
                  value={
                    newUserSearch
                  }
                  onChange={(event) =>
                    setNewUserSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Αναζήτηση χρήστη..."
                  className="mb-2 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />

                <div className="max-h-52 overflow-y-auto rounded-lg border bg-white p-2">
                  {filteredUploadUsers.length ===
                  0 ? (
                    <div className="px-2 py-3 text-sm text-gray-500">
                      Δεν βρέθηκαν
                      χρήστες.
                    </div>
                  ) : (
                    filteredUploadUsers.map(
                      (user) => (
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
                                  previous
                                ) =>
                                  toggleId(
                                    previous,
                                    user.id
                                  )
                              )
                            }
                            className="mt-0.5"
                          />

                          <span className="min-w-0 text-sm">
                            <span className="block break-words">
                              {
                                user.email
                              }
                            </span>

                            {user.name && (
                              <span className="block text-xs text-gray-500">
                                {
                                  user.name
                                }
                              </span>
                            )}
                          </span>
                        </label>
                      )
                    )
                  )}
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  {
                    newSelectedUserIds.length
                  }{" "}
                  επιλεγμένος/οι
                </div>
              </div>
            )}

            {assignmentMode ===
              "ALL" && (
              <div className="mt-3 rounded-lg border bg-white p-3 text-sm text-gray-600">
                Το αρχείο θα ανατεθεί
                σε όλους τους ενεργούς
                χρήστες.
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={savingNew}
          onClick={createManual}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--brand,#25C3F4)] px-4 py-3 font-semibold text-black hover:opacity-90 disabled:opacity-60 sm:w-auto"
        >
          <Upload size={18} />

          {savingNew
            ? "Αποθήκευση..."
            : assignmentMode ===
                "ALL"
              ? "Προσθήκη και ανάθεση σε όλους"
              : newSelectedUserIds.length
                ? `Προσθήκη και ανάθεση σε ${newSelectedUserIds.length}`
                : "Προσθήκη αρχείου"}
        </button>
      </section>

      {/* Tabs */}
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex flex-wrap gap-2 border-b bg-gray-50 p-3">
          <TabButton
            active={
              activeTab === "EXCEL"
            }
            onClick={() =>
              changeTab("EXCEL")
            }
            icon={
              <FileSpreadsheet
                size={17}
              />
            }
          >
            Excel ({excelFiles.length})
          </TabButton>

          <TabButton
            active={
              activeTab === "PDF"
            }
            onClick={() =>
              changeTab("PDF")
            }
            icon={
              <FileText size={17} />
            }
          >
            PDF ({pdfFiles.length})
          </TabButton>

          {otherFiles.length > 0 && (
            <TabButton
              active={
                activeTab === "OTHER"
              }
              onClick={() =>
                changeTab("OTHER")
              }
              icon={<File size={17} />}
            >
              Άλλα (
              {otherFiles.length})
            </TabButton>
          )}
        </div>

        {/* Breadcrumb for PDF */}
        {activeTab === "PDF" &&
          currentFolder && (
            <div className="flex items-center gap-2 border-b px-3 py-2 sm:px-4">
              <button
                type="button"
                onClick={() => {
                  setCurrentFolderId(
                    null
                  );
                  setQuery("");
                }}
                className="rounded-lg border p-2 hover:bg-gray-50"
                title="Πίσω"
              >
                <ArrowLeft
                  size={16}
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  setCurrentFolderId(
                    null
                  )
                }
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                PDF
              </button>

              <span className="text-gray-400">
                ›
              </span>

              <span className="truncate text-sm font-medium">
                {
                  currentFolder.name
                }
              </span>
            </div>
          )}

        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="Αναζήτηση τίτλου, αρχείου ή χρήστη..."
            className="w-full rounded-xl border px-3 py-2 text-sm sm:max-w-[480px]"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">
              {activeTab === "PDF" &&
              !currentFolderId
                ? visibleFolders.length +
                  visibleFiles.length
                : visibleFiles.length}{" "}
              στοιχείο(α)
            </span>

            {activeTab === "PDF" &&
              !currentFolderId && (
                <button
                  type="button"
                  onClick={createFolder}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  <Plus size={16} />
                  Νέος φάκελος
                </button>
              )}
          </div>
        </div>

        {/* Explorer */}
        <div className="min-h-[440px] p-2 sm:p-4 lg:p-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Φόρτωση...
            </div>
          ) : visibleFolders.length ===
              0 &&
            visibleFiles.length ===
              0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Δεν βρέθηκαν αρχεία.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {/* PDF folders */}
              {activeTab === "PDF" &&
                !currentFolderId &&
                visibleFolders.map(
                  (folder) => (
                    <div
                      key={
                        folder.id
                      }
                      className="group relative flex min-w-0 flex-col items-center rounded-lg border border-transparent px-1 py-3 text-center transition hover:border-blue-200 hover:bg-blue-50/70 sm:px-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentFolderId(
                            folder.id
                          );
                          setQuery(
                            ""
                          );
                        }}
                        className="flex w-full flex-col items-center"
                      >
                        <div className="flex h-16 items-center justify-center sm:h-20">
                          <Folder
                            size={62}
                            strokeWidth={
                              1.35
                            }
                            className="text-amber-500"
                          />
                        </div>

                        <div className="mt-1 line-clamp-3 w-full break-words text-xs font-medium sm:text-sm">
                          {
                            folder.name
                          }
                        </div>
                      </button>

                      <div className="mt-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentFolderId(
                              folder.id
                            )
                          }
                          className="rounded-md border bg-white p-1.5"
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
                          className="rounded-md border bg-white p-1.5"
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
                          className="rounded-md border bg-white p-1.5 text-red-600"
                          title="Διαγραφή"
                        >
                          <Trash2
                            size={15}
                          />
                        </button>
                      </div>
                    </div>
                  )
                )}

              {/* Files */}
              {visibleFiles.map(
                (file) => (
                  <AdminFileCard
                    key={file.id}
                    file={file}
                    folders={folders}
                    isPdf={isPdfFile(
                      file
                    )}
                    isExcel={isExcelFile(
                      file
                    )}
                    moveMenuFileId={
                      moveMenuFileId
                    }
                    setMoveMenuFileId={
                      setMoveMenuFileId
                    }
                    onMovePdf={
                      movePdf
                    }
                    onManage={() =>
                      setManageFileId(
                        file.id
                      )
                    }
                    onDelete={() =>
                      deleteEntireFile(
                        file.id
                      )
                    }
                    working={
                      workingFileId ===
                      file.id
                    }
                  />
                )
              )}
            </div>
          )}
        </div>
      </section>

      {/* Admin tools */}
      <details className="rounded-2xl border bg-white">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium">
          <Settings size={17} />
          Εργαλεία διαχειριστή
        </summary>

        <div className="flex flex-wrap gap-2 border-t p-4">
          <button
            type="button"
            onClick={
              checkMissingStorage
            }
            disabled={
              checkingMissing
            }
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {checkingMissing
              ? "Έλεγχος..."
              : "Έλεγχος missing storage"}
          </button>

          <button
            type="button"
            onClick={
              cleanupMissingStorage
            }
            disabled={
              cleaningMissing
            }
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {cleaningMissing
              ? "Καθαρισμός..."
              : "Καθαρισμός broken files"}
          </button>

          <button
            type="button"
            onClick={
              cleanupDuplicates
            }
            disabled={
              cleaningDuplicates
            }
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {cleaningDuplicates
              ? "Έλεγχος..."
              : "Έλεγχος duplicates"}
          </button>
        </div>
      </details>

      {/* Assignment modal */}
      {managingFile && (
        <AssignmentModal
          file={managingFile}
          activeUsers={activeUsers}
          assigning={
            assignmentSelections[
              managingFile.id
            ] || []
          }
          removing={
            removalSelections[
              managingFile.id
            ] || []
          }
          working={
            workingFileId ===
            managingFile.id
          }
          onClose={() =>
            setManageFileId(null)
          }
          onToggleAssign={(
            userId
          ) =>
            setAssignmentSelections(
              (previous) => ({
                ...previous,
                [managingFile.id]:
                  toggleId(
                    previous[
                      managingFile.id
                    ] || [],
                    userId
                  ),
              })
            )
          }
          onToggleRemove={(
            userId
          ) =>
            setRemovalSelections(
              (previous) => ({
                ...previous,
                [managingFile.id]:
                  toggleId(
                    previous[
                      managingFile.id
                    ] || [],
                    userId
                  ),
              })
            )
          }
          onAssignSelected={() =>
            assignSelected(
              managingFile.id
            )
          }
          onAssignAll={() =>
            assignToAll(
              managingFile.id
            )
          }
          onRemoveSelected={() =>
            removeSelectedAssignments(
              managingFile.id
            )
          }
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-blue-200 bg-blue-50 text-blue-900"
          : "bg-white hover:bg-gray-50",
      ].join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}

function AdminFileCard({
  file,
  folders,
  isPdf,
  isExcel,
  moveMenuFileId,
  setMoveMenuFileId,
  onMovePdf,
  onManage,
  onDelete,
  working,
}: {
  file: FileRow;
  folders: FolderRow[];
  isPdf: boolean;
  isExcel: boolean;
  moveMenuFileId: string | null;
  setMoveMenuFileId: (
    value: string | null
  ) => void;
  onMovePdf: (
    fileId: string,
    folderId: string | null
  ) => Promise<void>;
  onManage: () => void;
  onDelete: () => void;
  working: boolean;
}) {
  const title =
    file.title ||
    file.originalName ||
    "Αρχείο";

  const assignedCount =
    file.assignments?.length || 0;

  return (
    <div className="group relative flex min-w-0 flex-col items-center rounded-lg border border-transparent px-1 py-3 text-center transition hover:border-blue-200 hover:bg-blue-50/70 sm:px-2">
      {file.url ? (
        <a
          href={
            isPdf
              ? file.url
              : `${file.url}?download=1`
          }
          target="_blank"
          rel="noreferrer"
          className="flex w-full min-w-0 flex-col items-center"
        >
          <FileIcon
            isPdf={isPdf}
            isExcel={isExcel}
          />

          <FileTitle
            title={title}
          />
        </a>
      ) : (
        <>
          <FileIcon
            isPdf={isPdf}
            isExcel={isExcel}
          />

          <FileTitle
            title={title}
          />
        </>
      )}

      <div className="mt-1 text-[10px] text-gray-400">
        {formatSize(file.size)}
      </div>

      <div className="mt-1 text-[10px] text-gray-500">
        {assignedCount} ανάθεση(εις)
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        {file.url && (
          <>
            {isPdf && (
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                title="Προβολή"
                className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
              >
                <Eye size={15} />
              </a>
            )}

            <a
              href={`${file.url}?download=1`}
              target="_blank"
              rel="noreferrer"
              title="Λήψη"
              className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
            >
              <Download size={15} />
            </a>
          </>
        )}

        <button
          type="button"
          onClick={onManage}
          title="Διαχείριση αναθέσεων"
          className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
        >
          <Users size={15} />
        </button>

        {isPdf && (
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setMoveMenuFileId(
                  moveMenuFileId ===
                    file.id
                    ? null
                    : file.id
                )
              }
              title="Μετακίνηση σε φάκελο"
              className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
            >
              <Folder size={15} />
            </button>

            {moveMenuFileId ===
              file.id && (
              <div className="absolute left-1/2 top-full z-50 mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-lg border bg-white py-1 text-left shadow-lg">
                <div className="border-b px-3 py-2 text-xs font-semibold text-gray-500">
                  Μετακίνηση σε
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    await onMovePdf(
                      file.id,
                      null
                    );

                    setMoveMenuFileId(
                      null
                    );
                  }}
                  className={[
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100",
                    !file.pdfFolderId
                      ? "bg-gray-50 font-medium"
                      : "",
                  ].join(" ")}
                >
                  <Folder
                    size={15}
                    className="text-gray-400"
                  />
                  Χωρίς φάκελο
                </button>

                {folders.map(
                  (folder) => (
                    <button
                      key={
                        folder.id
                      }
                      type="button"
                      onClick={async () => {
                        await onMovePdf(
                          file.id,
                          folder.id
                        );

                        setMoveMenuFileId(
                          null
                        );
                      }}
                      className={[
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100",
                        file.pdfFolderId ===
                        folder.id
                          ? "bg-gray-50 font-medium"
                          : "",
                      ].join(" ")}
                    >
                      <Folder
                        size={15}
                        className="text-amber-500"
                      />

                      <span className="truncate">
                        {
                          folder.name
                        }
                      </span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={working}
          onClick={onDelete}
          title="Οριστική διαγραφή"
          className="rounded-md border bg-white p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function FileIcon({
  isPdf,
  isExcel,
}: {
  isPdf: boolean;
  isExcel: boolean;
}) {
  return (
    <div className="flex h-16 items-center justify-center sm:h-20">
      {isExcel ? (
        <FileSpreadsheet
          size={58}
          strokeWidth={1.4}
          className="text-emerald-600"
        />
      ) : isPdf ? (
        <FileText
          size={58}
          strokeWidth={1.4}
          className="text-red-600"
        />
      ) : (
        <File
          size={58}
          strokeWidth={1.4}
          className="text-gray-500"
        />
      )}
    </div>
  );
}

function FileTitle({
  title,
}: {
  title: string;
}) {
  return (
    <div
      className="mt-1 w-full overflow-hidden break-words text-xs font-medium leading-4 text-gray-800 sm:text-sm sm:leading-5"
      style={{
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient:
          "vertical",
      }}
    >
      {title}
    </div>
  );
}

function AssignmentModal({
  file,
  activeUsers,
  assigning,
  removing,
  working,
  onClose,
  onToggleAssign,
  onToggleRemove,
  onAssignSelected,
  onAssignAll,
  onRemoveSelected,
}: {
  file: FileRow;
  activeUsers: UserRow[];
  assigning: string[];
  removing: string[];
  working: boolean;
  onClose: () => void;
  onToggleAssign: (
    id: string
  ) => void;
  onToggleRemove: (
    id: string
  ) => void;
  onAssignSelected: () => void;
  onAssignAll: () => void;
  onRemoveSelected: () => void;
}) {
  const assignedUsers = (
    file.assignments || []
  ).map(
    (assignment) =>
      assignment.user
  );

  const assignedIds =
    assignedUsers.map(
      (user) => user.id
    );

  const assignableUsers =
    activeUsers.filter(
      (user) =>
        !assignedIds.includes(
          user.id
        )
    );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-3">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-semibold">
              Διαχείριση αναθέσεων
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {file.title}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Κλείσιμο
          </button>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <section className="rounded-xl border p-3">
            <h3 className="font-semibold">
              Πρόσθετη ανάθεση
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              Επιλέξτε νέους χρήστες.
            </p>

            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border bg-gray-50 p-2">
              {assignableUsers.length ===
              0 ? (
                <div className="p-3 text-sm text-gray-500">
                  Δεν υπάρχουν άλλοι
                  διαθέσιμοι χρήστες.
                </div>
              ) : (
                assignableUsers.map(
                  (user) => (
                    <label
                      key={
                        user.id
                      }
                      className="flex cursor-pointer gap-2 rounded-lg px-2 py-2 hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={assigning.includes(
                          user.id
                        )}
                        onChange={() =>
                          onToggleAssign(
                            user.id
                          )
                        }
                        className="mt-0.5"
                      />

                      <span className="text-sm">
                        <span className="block">
                          {
                            user.email
                          }
                        </span>

                        {user.name && (
                          <span className="block text-xs text-gray-500">
                            {
                              user.name
                            }
                          </span>
                        )}
                      </span>
                    </label>
                  )
                )
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  working ||
                  assigning.length ===
                    0
                }
                onClick={
                  onAssignSelected
                }
                className="rounded-lg bg-[color:var(--brand,#25C3F4)] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
              >
                Ανάθεση επιλεγμένων
              </button>

              <button
                type="button"
                disabled={working}
                onClick={onAssignAll}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Ανάθεση σε όλους
              </button>
            </div>
          </section>

          <section className="rounded-xl border p-3">
            <h3 className="font-semibold">
              Ανατεθειμένο σε
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              Επιλέξτε χρήστες για
              αφαίρεση.
            </p>

            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border bg-gray-50 p-2">
              {assignedUsers.length ===
              0 ? (
                <div className="p-3 text-sm text-gray-500">
                  Δεν έχει ανατεθεί σε
                  κάποιον χρήστη.
                </div>
              ) : (
                assignedUsers.map(
                  (user) => (
                    <label
                      key={
                        user.id
                      }
                      className="flex cursor-pointer gap-2 rounded-lg px-2 py-2 hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={removing.includes(
                          user.id
                        )}
                        onChange={() =>
                          onToggleRemove(
                            user.id
                          )
                        }
                        className="mt-0.5"
                      />

                      <span className="text-sm">
                        <span className="block">
                          {
                            user.email
                          }
                        </span>

                        {user.name && (
                          <span className="block text-xs text-gray-500">
                            {
                              user.name
                            }
                          </span>
                        )}
                      </span>
                    </label>
                  )
                )
              )}
            </div>

            <button
              type="button"
              disabled={
                working ||
                removing.length === 0
              }
              onClick={
                onRemoveSelected
              }
              className="mt-3 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Αφαίρεση από
              επιλεγμένους
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}