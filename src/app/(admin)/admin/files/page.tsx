// src/app/(admin)/admin/files/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Download,
  Eye,
  File as FileGlyph,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
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

type FolderRow = {
  id: string;
  name: string;
  ownerId?: string | null;
  createdAt?: string;
};

type FileAssignmentRow = {
  id?: string;
  userId?: string;
  pdfFolderId?: string | null;
  pdfFolder?: FolderRow | null;
  user: AssignedUser;
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
  pdfFolder?: FolderRow | null;
  uploadedBy?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;
  assignments?: FileAssignmentRow[];
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  status?: string;
  role?: string;
};

type LogicalFolderUser = {
  id: string;
  email: string;
  name: string | null;
  status?: string;
  folderId: string;
};

type LogicalFolderRow = {
  name: string;
  count: number;
  totalUsers: number;
  missingCount: number;
  complete: boolean;
  users: LogicalFolderUser[];
};

type FileTab = "EXCEL" | "PDF" | "OTHER";
type AssignmentMode = "SELECTED" | "ALL";
type PdfViewMode = "ALL_FILES" | "USER_FOLDERS";

function filenameWithoutExtension(name: string) {
  return name.replace(/\.[^/.]+$/, "");
}

function cleanUploadedFilename(name: string) {
  return filenameWithoutExtension(name).replace(
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}__?/i,
    ""
  );
}

function isPdfFile(file: FileRow) {
  const name = (file.originalName || file.title || "").toLowerCase();
  const mime = (file.mime || "").toLowerCase();

  return mime.includes("pdf") || name.endsWith(".pdf");
}

function isExcelFile(file: FileRow) {
  const name = (file.originalName || file.title || "").toLowerCase();
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

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }

  return `${value.toFixed(value < 10 && index > 0 ? 1 : 0)} ${units[index]}`;
}

function getApiError(json: any, fallback: string) {
  if (json?.error === "folder_owner_mismatch") {
    return "Ο επιλεγμένος φάκελος δεν ανήκει στον συγκεκριμένο χρήστη.";
  }

  if (json?.error === "folder_not_found") {
    return "Ο επιλεγμένος φάκελος δεν βρέθηκε.";
  }

  if (json?.error === "legacy_global_folder") {
    return "Ο παλιός κοινόχρηστος φάκελος δεν μπορεί να χρησιμοποιηθεί.";
  }

  if (
    json?.error === "folder_missing_for_users" ||
    json?.error === "folder_missing_for_selected_users"
  ) {
    return (
      json?.detail ||
      "Ο φάκελος δεν υπάρχει για όλους τους επιλεγμένους χρήστες."
    );
  }

  if (json?.error === "pdf_requires_user") {
    return "Επιλέξτε τουλάχιστον έναν χρήστη για το PDF.";
  }

  if (json?.error === "target_user_required") {
    return json?.detail || "Πρέπει να καθοριστεί ο χρήστης.";
  }

  return json?.detail || json?.error || fallback;
}

function getAssignmentForUser(file: FileRow, userId: string) {
  return (
    (file.assignments || []).find(
      (assignment) =>
        assignment.user.id === userId ||
        assignment.userId === userId
    ) || null
  );
}

function getPdfFolderIdForUser(
  file: FileRow,
  userId: string
): string | null {
  const assignment = getAssignmentForUser(file, userId);

  if (assignment?.pdfFolderId) {
    return assignment.pdfFolderId;
  }

  if (
    file.pdfFolderId &&
    file.pdfFolder?.ownerId === userId
  ) {
    return file.pdfFolderId;
  }

  return null;
}

export default function AdminFilesPage() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [logicalFolders, setLogicalFolders] =
    useState<LogicalFolderRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingLogicalFolders, setLoadingLogicalFolders] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState<FileTab>("EXCEL");

  const [pdfViewMode, setPdfViewMode] =
    useState<PdfViewMode>("ALL_FILES");

  const [selectedPdfUserId, setSelectedPdfUserId] =
    useState("");

  const [currentFolderId, setCurrentFolderId] =
    useState<string | null>(null);

  const [query, setQuery] = useState("");

  const [newTitle, setNewTitle] = useState("");

  const [newFile, setNewFile] =
    useState<globalThis.File | null>(null);

  const [newPdfFolderName, setNewPdfFolderName] =
    useState("");

  const [assignmentMode, setAssignmentMode] =
    useState<AssignmentMode>("SELECTED");

  const [newSelectedUserIds, setNewSelectedUserIds] =
    useState<string[]>([]);

  const [newUserSearch, setNewUserSearch] =
    useState("");

  const [savingNew, setSavingNew] =
    useState(false);

  const [manageFileId, setManageFileId] =
    useState<string | null>(null);

  const [assignmentSelections, setAssignmentSelections] =
    useState<Record<string, string[]>>({});

  const [removalSelections, setRemovalSelections] =
    useState<Record<string, string[]>>({});

  const [workingFileId, setWorkingFileId] =
    useState<string | null>(null);

  const [moveMenuFileId, setMoveMenuFileId] =
    useState<string | null>(null);

  const [cleaningDuplicates, setCleaningDuplicates] =
    useState(false);

  const [checkingMissing, setCheckingMissing] =
    useState(false);

  const [cleaningMissing, setCleaningMissing] =
    useState(false);

  async function load() {
    setLoading(true);

    try {
      const [filesResponse, usersResponse] =
        await Promise.all([
          fetch(
            `/api/files?scope=all&t=${Date.now()}`,
            {
              cache: "no-store",
            }
          ),

          fetch(
            `/api/admin/users?t=${Date.now()}`,
            {
              cache: "no-store",
            }
          ),
        ]);

      if (filesResponse.ok) {
        const json =
          await filesResponse.json();

        setFiles(
          Array.isArray(json.files)
            ? json.files
            : []
        );
      } else {
        console.error(
          "Failed to load files:",
          await filesResponse
            .json()
            .catch(() => ({}))
        );
      }

      if (usersResponse.ok) {
        const json =
          await usersResponse.json();

        setUsers(
          Array.isArray(json.users)
            ? json.users
            : []
        );
      } else {
        console.error(
          "Failed to load users:",
          await usersResponse
            .json()
            .catch(() => ({}))
        );
      }
    } catch (error) {
      console.error(
        "Failed to load admin files page:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadLogicalFolders() {
    setLoadingLogicalFolders(true);

    try {
      const response =
        await fetch(
          `/api/admin/pdf-folders?t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

      const json =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        console.error(
          "Failed to load logical PDF folders:",
          json
        );

        setLogicalFolders([]);
        return;
      }

      setLogicalFolders(
        Array.isArray(json.folders)
          ? json.folders
          : []
      );
    } catch (error) {
      console.error(
        "Failed to load logical PDF folders:",
        error
      );

      setLogicalFolders([]);
    } finally {
      setLoadingLogicalFolders(false);
    }
  }

  async function loadFoldersForUser(
    userId: string
  ) {
    if (!userId) {
      setFolders([]);
      setCurrentFolderId(null);
      return;
    }

    setLoadingFolders(true);

    try {
      const response =
        await fetch(
          `/api/pdf-folders?userId=${encodeURIComponent(
            userId
          )}&t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

      const json =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        console.error(
          "Failed to load PDF folders:",
          json
        );

        setFolders([]);
        return;
      }

      const nextFolders: FolderRow[] =
        Array.isArray(json.folders)
          ? json.folders
          : [];

      setFolders(nextFolders);

      setCurrentFolderId(
        (current) => {
          if (!current) {
            return null;
          }

          return nextFolders.some(
            (folder) =>
              folder.id === current
          )
            ? current
            : null;
        }
      );

      setMoveMenuFileId(null);
    } catch (error) {
      console.error(
        "Failed to load PDF folders:",
        error
      );

      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }

  useEffect(() => {
    void load();
    void loadLogicalFolders();
  }, []);

  const normalUsers =
    useMemo(
      () =>
        users.filter(
          (user) =>
            user.role !== "ADMIN"
        ),
      [users]
    );

  const activeUsers =
    useMemo(
      () =>
        normalUsers.filter(
          (user) =>
            user.status === "ACTIVE"
        ),
      [normalUsers]
    );

  const filteredUploadUsers =
    useMemo(() => {
      const q =
        newUserSearch
          .trim()
          .toLocaleLowerCase("el");

      if (!q) {
        return activeUsers;
      }

      return activeUsers.filter(
        (user) => {
          const email =
            user.email
              .toLocaleLowerCase("el");

          const name =
            (user.name || "")
              .toLocaleLowerCase("el");

          return (
            email.includes(q) ||
            name.includes(q)
          );
        }
      );
    }, [
      activeUsers,
      newUserSearch,
    ]);

  const selectedPdfExplorerUser =
    useMemo(() => {
      if (!selectedPdfUserId) {
        return null;
      }

      return (
        normalUsers.find(
          (user) =>
            user.id ===
            selectedPdfUserId
        ) || null
      );
    }, [
      normalUsers,
      selectedPdfUserId,
    ]);

  const selectedFileIsPdf =
    !!newFile &&
    (
      newFile.type ===
        "application/pdf" ||
      newFile.name
        .toLowerCase()
        .endsWith(".pdf")
    );

  const excelFiles =
    useMemo(
      () =>
        files.filter(
          isExcelFile
        ),
      [files]
    );

  const pdfFiles =
    useMemo(
      () =>
        files.filter(
          isPdfFile
        ),
      [files]
    );

  const otherFiles =
    useMemo(
      () =>
        files.filter(
          (file) =>
            !isExcelFile(file) &&
            !isPdfFile(file)
        ),
      [files]
    );

  const uploadTargetUserIds =
    useMemo(() => {
      if (
        assignmentMode ===
        "ALL"
      ) {
        return activeUsers.map(
          (user) =>
            user.id
        );
      }

      return newSelectedUserIds;
    }, [
      assignmentMode,
      activeUsers,
      newSelectedUserIds,
    ]);

  const availableUploadFolders =
    useMemo(() => {
      if (
        !selectedFileIsPdf ||
        uploadTargetUserIds.length === 0
      ) {
        return [];
      }

      return logicalFolders.filter(
        (folder) => {
          const ownerIds =
            new Set(
              (folder.users || []).map(
                (user) =>
                  user.id
              )
            );

          return uploadTargetUserIds.every(
            (userId) =>
              ownerIds.has(userId)
          );
        }
      );
    }, [
      selectedFileIsPdf,
      uploadTargetUserIds,
      logicalFolders,
    ]);

  useEffect(() => {
    if (!newPdfFolderName) {
      return;
    }

    if (
      !availableUploadFolders.some(
        (folder) =>
          folder.name ===
          newPdfFolderName
      )
    ) {
      setNewPdfFolderName("");
    }
  }, [
    availableUploadFolders,
    newPdfFolderName,
  ]);

  const currentFolder =
    useMemo(() => {
      if (!currentFolderId) {
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

  const selectedUserPdfFiles =
    useMemo(() => {
      if (!selectedPdfUserId) {
        return [];
      }

      return pdfFiles.filter(
        (file) => {
          const assignments =
            file.assignments || [];

          const assigned =
            assignments.some(
              (assignment) =>
                assignment.user.id ===
                  selectedPdfUserId ||
                assignment.userId ===
                  selectedPdfUserId
            );

          const legacyOwnUpload =
            assignments.length === 0 &&
            file.uploadedBy?.id ===
              selectedPdfUserId;

          return (
            assigned ||
            legacyOwnUpload
          );
        }
      );
    }, [
      pdfFiles,
      selectedPdfUserId,
    ]);

  const selectedUserFolderIds =
    useMemo(
      () =>
        new Set(
          folders.map(
            (folder) =>
              folder.id
          )
        ),
      [folders]
    );

  const visibleFiles =
    useMemo(() => {
      const q =
        query
          .trim()
          .toLocaleLowerCase("el");

      let source: FileRow[] = [];

      if (
        activeTab ===
        "EXCEL"
      ) {
        source = excelFiles;
      } else if (
        activeTab ===
        "OTHER"
      ) {
        source = otherFiles;
      } else if (
        pdfViewMode ===
        "ALL_FILES"
      ) {
        source = pdfFiles;
      } else {
        if (!selectedPdfUserId) {
          return [];
        }

        if (currentFolder) {
          source =
            selectedUserPdfFiles.filter(
              (file) =>
                getPdfFolderIdForUser(
                  file,
                  selectedPdfUserId
                ) ===
                currentFolder.id
            );
        } else {
          source =
            selectedUserPdfFiles.filter(
              (file) => {
                const folderId =
                  getPdfFolderIdForUser(
                    file,
                    selectedPdfUserId
                  );

                return (
                  !folderId ||
                  !selectedUserFolderIds.has(
                    folderId
                  )
                );
              }
            );
        }
      }

      if (!q) {
        return source;
      }

      return source.filter(
        (file) => {
          const title =
            (file.title || "")
              .toLocaleLowerCase("el");

          const originalName =
            (file.originalName || "")
              .toLocaleLowerCase("el");

          const assignedText =
            (file.assignments || [])
              .map(
                (assignment) =>
                  `${
                    assignment.user.email
                  } ${
                    assignment.user.name ||
                    ""
                  }`
              )
              .join(" ")
              .toLocaleLowerCase("el");

          return (
            title.includes(q) ||
            originalName.includes(q) ||
            assignedText.includes(q)
          );
        }
      );
    }, [
      activeTab,
      pdfViewMode,
      excelFiles,
      pdfFiles,
      otherFiles,
      selectedPdfUserId,
      selectedUserPdfFiles,
      selectedUserFolderIds,
      currentFolder,
      query,
    ]);

  const visibleFolders =
    useMemo(() => {
      if (
        activeTab !== "PDF" ||
        pdfViewMode !==
          "USER_FOLDERS" ||
        !selectedPdfUserId ||
        currentFolder
      ) {
        return [];
      }

      const q =
        query
          .trim()
          .toLocaleLowerCase("el");

      if (!q) {
        return folders;
      }

      return folders.filter(
        (folder) =>
          folder.name
            .toLocaleLowerCase("el")
            .includes(q)
      );
    }, [
      activeTab,
      pdfViewMode,
      selectedPdfUserId,
      currentFolder,
      folders,
      query,
    ]);

  const managingFile =
    useMemo(
      () =>
        files.find(
          (file) =>
            file.id ===
            manageFileId
        ) || null,
      [
        files,
        manageFileId,
      ]
    );

  function toggleId(
    current: string[],
    id: string
  ) {
    return current.includes(id)
      ? current.filter(
          (item) =>
            item !== id
        )
      : [
          ...current,
          id,
        ];
  }

  function changeTab(
    tab: FileTab
  ) {
    setActiveTab(tab);
    setCurrentFolderId(null);
    setMoveMenuFileId(null);
    setQuery("");

    if (
      tab === "PDF" &&
      pdfViewMode ===
        "USER_FOLDERS" &&
      selectedPdfUserId
    ) {
      void loadFoldersForUser(
        selectedPdfUserId
      );
    }
  }

  function changePdfViewMode(
    mode: PdfViewMode
  ) {
    setPdfViewMode(mode);
    setCurrentFolderId(null);
    setMoveMenuFileId(null);
    setQuery("");

    if (
      mode ===
        "USER_FOLDERS" &&
      selectedPdfUserId
    ) {
      void loadFoldersForUser(
        selectedPdfUserId
      );
    }
  }

  function changePdfExplorerUser(
    userId: string
  ) {
    setSelectedPdfUserId(userId);
    setCurrentFolderId(null);
    setMoveMenuFileId(null);
    setFolders([]);
    setQuery("");

    if (userId) {
      void loadFoldersForUser(
        userId
      );
    }
  }

  function changeUploadAssignmentMode(
    mode: AssignmentMode
  ) {
    setAssignmentMode(mode);
    setNewPdfFolderName("");

    if (selectedFileIsPdf) {
      void loadLogicalFolders();
    }
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

    if (
      selectedFileIsPdf &&
      assignmentMode ===
        "SELECTED" &&
      newSelectedUserIds.length ===
        0
    ) {
      alert(
        "Επιλέξτε τουλάχιστον έναν χρήστη για το PDF."
      );

      return;
    }

    setSavingNew(true);

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

      if (
        assignmentMode ===
        "ALL"
      ) {
        formData.append(
          "assignTo",
          "ALL"
        );
      } else if (
        newSelectedUserIds.length >
        0
      ) {
        formData.append(
          "assignTo",
          JSON.stringify(
            newSelectedUserIds
          )
        );
      }

      if (
        selectedFileIsPdf &&
        newPdfFolderName
      ) {
        formData.append(
          "pdfFolderName",
          newPdfFolderName
        );
      }

      const response =
        await fetch(
          "/api/files",
          {
            method: "POST",
            body: formData,
          }
        );

      const json =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getApiError(
            json,
            "Αποτυχία δημιουργίας αρχείου"
          )
        );
      }

      setNewTitle("");
      setNewFile(null);
      setNewPdfFolderName("");
      setNewSelectedUserIds([]);
      setNewUserSearch("");
      setAssignmentMode("SELECTED");

      const input =
        document.getElementById(
          "admin-manual-file-input"
        ) as
          | HTMLInputElement
          | null;

      if (input) {
        input.value = "";
      }

      await load();

      if (
        activeTab === "PDF" &&
        pdfViewMode ===
          "USER_FOLDERS" &&
        selectedPdfUserId
      ) {
        await loadFoldersForUser(
          selectedPdfUserId
        );
      }
    } catch (error: any) {
      alert(
        error?.message ||
          "Σφάλμα"
      );
    } finally {
      setSavingNew(false);
    }
  }

  async function assignSelected(
    fileId: string
  ) {
    const userIds =
      assignmentSelections[
        fileId
      ] || [];

    if (
      userIds.length === 0
    ) {
      alert(
        "Επιλέξτε τουλάχιστον έναν χρήστη."
      );

      return;
    }

    setWorkingFileId(fileId);

    try {
      const response =
        await fetch(
          "/api/assignments",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                fileId,
                userIds,
              }),
          }
        );

      const json =
        await response
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
      const response =
        await fetch(
          "/api/assignments",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                fileId,
                all: true,
              }),
          }
        );

      const json =
        await response
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
      removalSelections[
        fileId
      ] || [];

    if (
      userIds.length === 0
    ) {
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
      const response =
        await fetch(
          `/api/admin/files/${fileId}`,
          {
            method: "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                userIds,
                deleteEntireFile:
                  false,
              }),
          }
        );

      const json =
        await response
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
      const response =
        await fetch(
          `/api/admin/files/${fileId}`,
          {
            method: "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                deleteEntireFile:
                  true,
              }),
          }
        );

      const json =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία διαγραφής αρχείου"
        );
      }

      setFiles(
        (previous) =>
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

      if (
        moveMenuFileId === fileId
      ) {
        setMoveMenuFileId(null);
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
    if (!selectedPdfUserId) {
      alert(
        "Επιλέξτε πρώτα χρήστη."
      );

      return;
    }

    const response =
      await fetch(
        `/api/files/${fileId}/pdf-folder`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              pdfFolderId:
                folderId,

              userId:
                selectedPdfUserId,
            }),
        }
      );

    const json =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      alert(
        getApiError(
          json,
          "Αποτυχία μετακίνησης PDF."
        )
      );

      return;
    }

    setMoveMenuFileId(null);

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
      const response =
        await fetch(
          "/api/admin/files/cleanup-duplicates",
          {
            method: "POST",
          }
        );

      const json =
        await response
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
      const response =
        await fetch(
          "/api/admin/files/check-missing-storage",
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
      const response =
        await fetch(
          "/api/admin/files/cleanup-missing-storage",
          {
            method: "POST",
          }
        );

      const json =
        await response
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
      <div>
        <h1 className="text-2xl font-semibold">
          Διαχείριση αρχείων
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Ανέβασμα, ανάθεση και οργάνωση αρχείων χρηστών.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold">
            Προσθήκη νέου αρχείου
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Επιλέξτε όσους χρήστες θέλετε. Για PDF εμφανίζονται μόνο οι φάκελοι που υπάρχουν σε όλους τους επιλεγμένους χρήστες.
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

                  setNewPdfFolderName("");

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

                  const pdf =
                    !!selectedFile &&
                    (
                      selectedFile.type ===
                        "application/pdf" ||
                      selectedFile.name
                        .toLowerCase()
                        .endsWith(".pdf")
                    );

                  if (pdf) {
                    void loadLogicalFolders();
                  }
                }}
              />
            </label>

            {selectedFileIsPdf && (
              <div className="rounded-xl border bg-gray-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      Φάκελος τεκμηρίωσης
                    </div>

                    <p className="mt-1 text-xs text-gray-500">
                      Εμφανίζονται μόνο οι φάκελοι που υπάρχουν σε όλους τους χρήστες που θα λάβουν το PDF.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void loadLogicalFolders()
                    }
                    disabled={
                      loadingLogicalFolders
                    }
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-500 hover:text-black disabled:opacity-50"
                  >
                    <RefreshCw
                      size={13}
                      className={
                        loadingLogicalFolders
                          ? "animate-spin"
                          : ""
                      }
                    />

                    Ανανέωση
                  </button>
                </div>

                {uploadTargetUserIds.length === 0 ? (
                  <div className="mt-3 rounded-lg border bg-white p-3 text-sm text-gray-500">
                    Επιλέξτε πρώτα τουλάχιστον έναν χρήστη.
                  </div>
                ) : (
                  <>
                    <select
                      value={
                        newPdfFolderName
                      }
                      onChange={(event) =>
                        setNewPdfFolderName(
                          event.target.value
                        )
                      }
                      disabled={
                        loadingLogicalFolders
                      }
                      className="mt-3 w-full rounded-xl border bg-white px-3 py-2.5 text-sm disabled:opacity-50"
                    >
                      <option value="">
                        Χωρίς φάκελο
                      </option>

                      {availableUploadFolders.map(
                        (folder) => (
                          <option
                            key={
                              folder.name
                            }
                            value={
                              folder.name
                            }
                          >
                            {
                              folder.name
                            }
                          </option>
                        )
                      )}
                    </select>

                    <p className="mt-2 text-xs text-gray-500">
                      {loadingLogicalFolders
                        ? "Φόρτωση φακέλων..."
                        : `${availableUploadFolders.length} διαθέσιμοι φάκελοι για ${uploadTargetUserIds.length} επιλεγμένο/ους χρήστη/ες.`}
                    </p>

                    {!loadingLogicalFolders &&
                      availableUploadFolders.length === 0 && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                          Δεν υπάρχει κοινός φάκελος που να ανήκει σε όλους τους επιλεγμένους χρήστες. Μπορείτε να επιλέξετε «Χωρίς φάκελο» ή να αλλάξετε τους χρήστες.
                        </div>
                      )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-gray-50 p-4">
            <h3 className="font-semibold">
              Ανάθεση αρχείου
            </h3>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2.5">
                <input
                  type="radio"
                  name="assignment-mode"
                  checked={
                    assignmentMode ===
                    "SELECTED"
                  }
                  onChange={() =>
                    changeUploadAssignmentMode(
                      "SELECTED"
                    )
                  }
                />

                <span className="text-sm font-medium">
                  Σε επιλεγμένους χρήστες
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
                    changeUploadAssignmentMode(
                      "ALL"
                    )
                  }
                />

                <span className="text-sm font-medium">
                  Σε όλους τους ενεργούς χρήστες
                </span>
              </label>
            </div>

            {assignmentMode ===
            "SELECTED" ? (
              <div className="mt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">
                    {
                      newSelectedUserIds.length
                    }
                    {" / "}
                    {
                      activeUsers.length
                    }{" "}
                    επιλεγμένος/οι
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNewSelectedUserIds(
                          activeUsers.map(
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
                  onChange={(event) =>
                    setNewUserSearch(
                      event.target.value
                    )
                  }
                  placeholder="Αναζήτηση χρήστη..."
                  className="mb-2 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />

                <div className="max-h-60 overflow-y-auto rounded-lg border bg-white p-2">
                  {filteredUploadUsers.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-gray-500">
                      Δεν βρέθηκαν χρήστες.
                    </div>
                  ) : (
                    filteredUploadUsers.map(
                      (user) => {
                        const selected =
                          newSelectedUserIds.includes(
                            user.id
                          );

                        return (
                          <label
                            key={
                              user.id
                            }
                            className={`flex cursor-pointer gap-2 rounded-lg px-2 py-2 ${
                              selected
                                ? "bg-cyan-50"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={
                                selected
                              }
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
                        );
                      }
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border bg-white p-3">
                <div className="text-sm font-medium">
                  Όλοι οι ενεργοί χρήστες
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  {
                    activeUsers.length
                  }{" "}
                  χρήστης/ες θα λάβουν το αρχείο.
                </div>

                {selectedFileIsPdf && (
                  <div className="mt-2 text-xs text-gray-500">
                    Το PDF αποθηκεύεται μία φορά στο Supabase. Κάθε χρήστης έχει ξεχωριστή ανάθεση και ξεχωριστό προσωπικό φάκελο.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={
            savingNew
          }
          onClick={
            createManual
          }
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--brand,#25C3F4)] px-4 py-3 font-semibold text-black hover:opacity-90 disabled:opacity-60 sm:w-auto"
        >
          <Upload
            size={18}
          />

          {savingNew
            ? "Αποθήκευση..."
            : assignmentMode ===
                "ALL"
              ? `Προσθήκη και ανάθεση σε όλους (${activeUsers.length})`
              : newSelectedUserIds.length
                ? `Προσθήκη και ανάθεση σε ${newSelectedUserIds.length}`
                : "Προσθήκη αρχείου"}
        </button>
      </section>

      <section className="overflow-visible rounded-2xl border bg-white">
        <div className="flex flex-wrap gap-2 border-b bg-gray-50 p-3">
          <TabButton
            active={
              activeTab ===
              "EXCEL"
            }
            onClick={() =>
              changeTab(
                "EXCEL"
              )
            }
            icon={
              <FileSpreadsheet
                size={17}
              />
            }
          >
            Excel (
            {
              excelFiles.length
            }
            )
          </TabButton>

          <TabButton
            active={
              activeTab ===
              "PDF"
            }
            onClick={() =>
              changeTab(
                "PDF"
              )
            }
            icon={
              <FileText
                size={17}
              />
            }
          >
            PDF (
            {
              pdfFiles.length
            }
            )
          </TabButton>

          {otherFiles.length >
            0 && (
            <TabButton
              active={
                activeTab ===
                "OTHER"
              }
              onClick={() =>
                changeTab(
                  "OTHER"
                )
              }
              icon={
                <FileGlyph
                  size={17}
                />
              }
            >
              Άλλα (
              {
                otherFiles.length
              }
              )
            </TabButton>
          )}
        </div>

        {activeTab ===
          "PDF" && (
          <div className="border-b bg-gray-50/70 p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  changePdfViewMode(
                    "ALL_FILES"
                  )
                }
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  pdfViewMode ===
                  "ALL_FILES"
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                Όλα τα PDF
              </button>

              <button
                type="button"
                onClick={() =>
                  changePdfViewMode(
                    "USER_FOLDERS"
                  )
                }
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  pdfViewMode ===
                  "USER_FOLDERS"
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                Φάκελοι ανά χρήστη
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              {pdfViewMode ===
              "ALL_FILES"
                ? "Αναζητήστε οποιοδήποτε PDF και πατήστε το εικονίδιο χρηστών για να δείτε σε ποιους έχει ανατεθεί."
                : "Επιλέξτε χρήστη για να δείτε το προσωπικό Windows-style περιβάλλον φακέλων του."}
            </p>
          </div>
        )}

        {activeTab ===
          "PDF" &&
          pdfViewMode ===
            "USER_FOLDERS" && (
          <div className="border-b bg-cyan-50/40 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,480px)_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">
                  Χρήστης
                </span>

                <select
                  value={
                    selectedPdfUserId
                  }
                  onChange={(event) =>
                    changePdfExplorerUser(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">
                    Επιλέξτε χρήστη...
                  </option>

                  {normalUsers.map(
                    (user) => (
                      <option
                        key={
                          user.id
                        }
                        value={
                          user.id
                        }
                      >
                        {
                          user.email
                        }
                        {user.name
                          ? ` — ${user.name}`
                          : ""}
                        {user.status &&
                        user.status !==
                          "ACTIVE"
                          ? ` [${user.status}]`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </label>

              <button
                type="button"
                disabled={
                  !selectedPdfUserId ||
                  loadingFolders
                }
                onClick={() => {
                  if (
                    selectedPdfUserId
                  ) {
                    void loadFoldersForUser(
                      selectedPdfUserId
                    );
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={
                    loadingFolders
                      ? "animate-spin"
                      : ""
                  }
                />

                Ανανέωση
              </button>
            </div>

            {selectedPdfExplorerUser ? (
              <p className="mt-2 text-xs text-gray-600">
                Προβάλλονται οι προσωπικοί φάκελοι και τα PDF του{" "}
                <strong>
                  {
                    selectedPdfExplorerUser.email
                  }
                </strong>
                .
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-600">
                Επιλέξτε χρήστη για να δείτε τα PDF και τη θέση τους στους προσωπικούς του φακέλους.
              </p>
            )}
          </div>
        )}

        {activeTab ===
          "PDF" &&
          pdfViewMode ===
            "USER_FOLDERS" &&
          selectedPdfExplorerUser &&
          currentFolder && (
          <div className="flex items-center gap-2 border-b px-3 py-2 sm:px-4">
            <button
              type="button"
              onClick={() => {
                setCurrentFolderId(null);
                setMoveMenuFileId(null);
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
              onClick={() => {
                setCurrentFolderId(null);
                setMoveMenuFileId(null);
                setQuery("");
              }}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              PDF
            </button>

            <span className="text-gray-400">
              ›
            </span>

            <span className="max-w-[260px] truncate text-sm text-gray-500">
              {
                selectedPdfExplorerUser.email
              }
            </span>

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

        <div className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <input
            value={
              query
            }
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            disabled={
              activeTab ===
                "PDF" &&
              pdfViewMode ===
                "USER_FOLDERS" &&
              !selectedPdfUserId
            }
            placeholder={
              activeTab ===
                "PDF"
                ? pdfViewMode ===
                    "ALL_FILES"
                  ? "Αναζήτηση PDF, τίτλου ή ανατεθειμένου χρήστη..."
                  : currentFolder
                    ? "Αναζήτηση στον φάκελο..."
                    : "Αναζήτηση φακέλου ή PDF..."
                : "Αναζήτηση τίτλου, αρχείου ή χρήστη..."
            }
            className="w-full rounded-xl border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 sm:max-w-[520px]"
          />

          <span className="text-sm text-gray-500">
            {activeTab ===
              "PDF" &&
            pdfViewMode ===
              "USER_FOLDERS" &&
            !currentFolder
              ? visibleFolders.length +
                visibleFiles.length
              : visibleFiles.length}{" "}
            στοιχείο(α)
          </span>
        </div>

        <div className="min-h-[440px] p-2 sm:p-4 lg:p-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Φόρτωση...
            </div>
          ) : activeTab ===
              "PDF" &&
            pdfViewMode ===
              "USER_FOLDERS" &&
            !selectedPdfUserId ? (
            <div className="py-16 text-center">
              <Users
                size={42}
                className="mx-auto text-gray-300"
              />

              <div className="mt-3 text-sm font-medium text-gray-700">
                Επιλέξτε χρήστη
              </div>

              <div className="mt-1 text-sm text-gray-500">
                Θα εμφανιστούν μόνο οι φάκελοι και τα PDF του συγκεκριμένου χρήστη.
              </div>
            </div>
          ) : activeTab ===
              "PDF" &&
            pdfViewMode ===
              "USER_FOLDERS" &&
            loadingFolders &&
            folders.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Φόρτωση φακέλων...
            </div>
          ) : visibleFolders.length ===
              0 &&
            visibleFiles.length ===
              0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              {activeTab ===
                "PDF" &&
              pdfViewMode ===
                "USER_FOLDERS" &&
              currentFolder
                ? "Ο φάκελος είναι κενός."
                : "Δεν βρέθηκαν αρχεία ή φάκελοι."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {activeTab ===
                "PDF" &&
                pdfViewMode ===
                  "USER_FOLDERS" &&
                !currentFolder &&
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

                          setMoveMenuFileId(
                            null
                          );

                          setQuery("");
                        }}
                        className="flex w-full flex-col items-center"
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
                          onClick={() => {
                            setCurrentFolderId(
                              folder.id
                            );

                            setMoveMenuFileId(
                              null
                            );

                            setQuery("");
                          }}
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

              {visibleFiles.map(
                (file) => {
                  const pdf =
                    isPdfFile(
                      file
                    );

                  const currentPdfFolderId =
                    pdf &&
                    selectedPdfUserId &&
                    pdfViewMode ===
                      "USER_FOLDERS"
                      ? getPdfFolderIdForUser(
                          file,
                          selectedPdfUserId
                        )
                      : null;

                  return (
                    <AdminFileCard
                      key={
                        file.id
                      }
                      file={
                        file
                      }
                      folders={
                        pdf &&
                        pdfViewMode ===
                          "USER_FOLDERS"
                          ? folders
                          : []
                      }
                      isPdf={
                        pdf
                      }
                      isExcel={
                        isExcelFile(
                          file
                        )
                      }
                      currentPdfFolderId={
                        currentPdfFolderId
                      }
                      allowAssignmentManagement
                      allowPdfMove={
                        pdf &&
                        pdfViewMode ===
                          "USER_FOLDERS" &&
                        !!selectedPdfUserId
                      }
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
                  );
                }
              )}
            </div>
          )}
        </div>
      </section>

      <details className="rounded-2xl border bg-white">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium">
          <Settings
            size={17}
          />

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

      {managingFile &&
        isPdfFile(
          managingFile
        ) && (
        <PdfAssignmentsModal
          file={
            managingFile
          }
          onClose={() =>
            setManageFileId(
              null
            )
          }
        />
      )}

      {managingFile &&
        !isPdfFile(
          managingFile
        ) && (
        <AssignmentModal
          file={
            managingFile
          }
          activeUsers={
            activeUsers
          }
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
            setManageFileId(
              null
            )
          }
          onToggleAssign={(userId) =>
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
          onToggleRemove={(userId) =>
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
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-900"
          : "bg-white hover:bg-gray-50"
      }`}
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
  currentPdfFolderId,
  allowAssignmentManagement,
  allowPdfMove,
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
  currentPdfFolderId:
    | string
    | null;
  allowAssignmentManagement:
    boolean;
  allowPdfMove:
    boolean;
  moveMenuFileId:
    | string
    | null;
  setMoveMenuFileId: (
    value:
      | string
      | null
  ) => void;
  onMovePdf: (
    fileId: string,
    folderId:
      | string
      | null
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
    file.assignments
      ?.length || 0;

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
          <FileTypeIcon
            isPdf={
              isPdf
            }
            isExcel={
              isExcel
            }
          />

          <FileTitle
            title={
              title
            }
          />
        </a>
      ) : (
        <>
          <FileTypeIcon
            isPdf={
              isPdf
            }
            isExcel={
              isExcel
            }
          />

          <FileTitle
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

      <div className="mt-1 text-[10px] text-gray-500">
        {assignedCount}{" "}
        ανάθεση(εις)
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        {file.url && (
          <>
            {isPdf && (
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
            )}

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

        {allowAssignmentManagement && (
          <button
            type="button"
            onClick={
              onManage
            }
            title={
              isPdf
                ? "Προβολή αναθέσεων"
                : "Διαχείριση αναθέσεων"
            }
            className="rounded-md border bg-white p-1.5 hover:bg-gray-50"
          >
            <Users
              size={15}
            />
          </button>
        )}

        {isPdf &&
          allowPdfMove && (
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
              <Folder
                size={15}
              />
            </button>

            {moveMenuFileId ===
              file.id && (
              <div className="absolute left-1/2 top-full z-[200] mt-2 max-h-72 w-60 -translate-x-1/2 overflow-y-auto rounded-lg border bg-white py-1 text-left shadow-xl">
                <div className="border-b px-3 py-2 text-xs font-semibold text-gray-500">
                  Μετακίνηση σε
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void onMovePdf(
                      file.id,
                      null
                    )
                  }
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                    !currentPdfFolderId
                      ? "bg-gray-50 font-medium"
                      : ""
                  }`}
                >
                  <Folder
                    size={15}
                    className="text-gray-400"
                  />

                  Χωρίς φάκελο
                </button>

                {folders.length >
                0 ? (
                  folders.map(
                    (folder) => (
                      <button
                        key={
                          folder.id
                        }
                        type="button"
                        onClick={() =>
                          void onMovePdf(
                            file.id,
                            folder.id
                          )
                        }
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                          currentPdfFolderId ===
                          folder.id
                            ? "bg-gray-50 font-medium"
                            : ""
                        }`}
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
                    Δεν υπάρχουν φάκελοι για τον χρήστη.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={
            working
          }
          onClick={
            onDelete
          }
          title="Οριστική διαγραφή"
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

function FileTypeIcon({
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
        <FileGlyph
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

function PdfAssignmentsModal({
  file,
  onClose,
}: {
  file: FileRow;
  onClose: () => void;
}) {
  const assignments =
    file.assignments || [];

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-3"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-semibold">
              Αναθέσεις PDF
            </h2>

            <p className="mt-1 break-words text-sm text-gray-500">
              {
                file.title
              }
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Κλείσιμο
          </button>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                Ανατεθειμένο σε
              </h3>

              <p className="mt-1 text-xs text-gray-500">
                Όλοι οι χρήστες που έχουν πρόσβαση στο ίδιο PDF και ο προσωπικός φάκελος στον οποίο εμφανίζεται για τον καθένα.
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {
                assignments.length
              }{" "}
              χρήστης/ες
            </span>
          </div>

          {assignments.length === 0 ? (
            <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-500">
              Το PDF δεν έχει ανατεθεί σε κάποιον χρήστη.
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto rounded-xl border bg-gray-50 p-2">
              {assignments.map(
                (assignment) => (
                  <div
                    key={
                      assignment.id ||
                      assignment.user.id
                    }
                    className="mb-1 flex flex-col gap-1 rounded-lg bg-white px-3 py-3 last:mb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="break-words text-sm font-medium">
                        {
                          assignment.user.email
                        }
                      </div>

                      {assignment.user.name && (
                        <div className="mt-0.5 text-xs text-gray-500">
                          {
                            assignment.user.name
                          }
                        </div>
                      )}
                    </div>

                    <div className="mt-1 flex shrink-0 items-center gap-2 text-xs text-gray-600 sm:mt-0">
                      <Folder
                        size={14}
                        className={
                          assignment.pdfFolder
                            ? "text-amber-500"
                            : "text-gray-400"
                        }
                      />

                      <span>
                        {assignment.pdfFolder
                          ?.name ||
                          "Χωρίς φάκελο"}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
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
  const assignedUsers =
    (file.assignments || []).map(
      (assignment) =>
        assignment.user
    );

  const assignedIds =
    assignedUsers.map(
      (user) =>
        user.id
    );

  const assignableUsers =
    activeUsers.filter(
      (user) =>
        !assignedIds.includes(
          user.id
        )
    );

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-3"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-semibold">
              Διαχείριση αναθέσεων
            </h2>

            <p className="mt-1 break-words text-sm text-gray-500">
              {
                file.title
              }
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
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
              {assignableUsers.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">
                  Δεν υπάρχουν άλλοι διαθέσιμοι χρήστες.
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
                        checked={
                          assigning.includes(
                            user.id
                          )
                        }
                        onChange={() =>
                          onToggleAssign(
                            user.id
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

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  working ||
                  assigning.length === 0
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
                disabled={
                  working
                }
                onClick={
                  onAssignAll
                }
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
              Επιλέξτε χρήστες για αφαίρεση.
            </p>

            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border bg-gray-50 p-2">
              {assignedUsers.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">
                  Δεν έχει ανατεθεί σε κάποιον χρήστη.
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
                        checked={
                          removing.includes(
                            user.id
                          )
                        }
                        onChange={() =>
                          onToggleRemove(
                            user.id
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
              Αφαίρεση από επιλεγμένους
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}