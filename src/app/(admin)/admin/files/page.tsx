// src/app/(admin)/admin/files/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Download,
  Eye,
  File as FileIcon,
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

  const mime = (
    file.mime || ""
  ).toLowerCase();

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

  const mime = (
    file.mime || ""
  ).toLowerCase();

  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  );
}

function formatSize(
  bytes?: number | null
) {
  if (!bytes || bytes <= 0) {
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
    index < units.length - 1
  ) {
    value /= 1024;
    index++;
  }

  return `${value.toFixed(
    value < 10 && index > 0
      ? 1
      : 0
  )} ${units[index]}`;
}

function getApiError(
  json: any,
  fallback: string
) {
  if (
    json?.error ===
    "folder_owner_mismatch"
  ) {
    return "Ο επιλεγμένος φάκελος δεν ανήκει στον συγκεκριμένο χρήστη.";
  }

  if (
    json?.error ===
    "folder_not_found"
  ) {
    return "Ο επιλεγμένος φάκελος δεν βρέθηκε.";
  }

  if (
    json?.error ===
    "legacy_global_folder"
  ) {
    return "Ο παλιός κοινόχρηστος φάκελος δεν μπορεί να χρησιμοποιηθεί.";
  }

  if (
    json?.error ===
    "folder_missing_for_selected_users"
  ) {
    return (
      json?.detail ||
      "Ο φάκελος δεν υπάρχει για όλους τους επιλεγμένους χρήστες."
    );
  }

  if (
    json?.error ===
    "pdf_requires_user"
  ) {
    return "Επιλέξτε τουλάχιστον έναν χρήστη για το PDF.";
  }

  if (
    json?.error ===
    "target_user_required"
  ) {
    return (
      json?.detail ||
      "Πρέπει να καθοριστεί ο χρήστης."
    );
  }

  return (
    json?.detail ||
    json?.error ||
    fallback
  );
}

function getAssignmentForUser(
  file: FileRow,
  userId: string
) {
  return (
    (file.assignments || []).find(
      (assignment) =>
        assignment.user.id ===
          userId ||
        assignment.userId ===
          userId
    ) || null
  );
}

function getPdfFolderIdForUser(
  file: FileRow,
  userId: string
): string | null {
  const assignment =
    getAssignmentForUser(
      file,
      userId
    );

  if (
    assignment?.pdfFolderId
  ) {
    return assignment.pdfFolderId;
  }

  if (
    file.pdfFolderId &&
    file.pdfFolder?.ownerId ===
      userId
  ) {
    return file.pdfFolderId;
  }

  return null;
}

export default function AdminFilesPage() {
  const [
    files,
    setFiles,
  ] = useState<FileRow[]>(
    []
  );

  const [
    users,
    setUsers,
  ] = useState<UserRow[]>(
    []
  );

  const [
    folders,
    setFolders,
  ] = useState<FolderRow[]>(
    []
  );

  const [
    logicalFolders,
    setLogicalFolders,
  ] = useState<
    LogicalFolderRow[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadingFolders,
    setLoadingFolders,
  ] = useState(false);

  const [
    loadingLogicalFolders,
    setLoadingLogicalFolders,
  ] = useState(false);

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<FileTab>(
      "EXCEL"
    );

  const [
    pdfViewMode,
    setPdfViewMode,
  ] =
    useState<PdfViewMode>(
      "ALL_FILES"
    );

  const [
    selectedPdfUserId,
    setSelectedPdfUserId,
  ] = useState("");

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

  const [
    newTitle,
    setNewTitle,
  ] = useState("");

  const [
    newFile,
    setNewFile,
  ] =
    useState<
      globalThis.File | null
    >(null);

  const [
    newPdfFolderName,
    setNewPdfFolderName,
  ] = useState("");

  const [
    assignmentMode,
    setAssignmentMode,
  ] =
    useState<AssignmentMode>(
      "SELECTED"
    );

  const [
    newSelectedUserIds,
    setNewSelectedUserIds,
  ] = useState<string[]>(
    []
  );

  const [
    newUserSearch,
    setNewUserSearch,
  ] = useState("");

  const [
    savingNew,
    setSavingNew,
  ] = useState(false);

  const [
    manageFileId,
    setManageFileId,
  ] =
    useState<
      string | null
    >(null);

  const [
    assignmentSelections,
    setAssignmentSelections,
  ] = useState<
    Record<
      string,
      string[]
    >
  >({});

  const [
    removalSelections,
    setRemovalSelections,
  ] = useState<
    Record<
      string,
      string[]
    >
  >({});

  const [
    workingFileId,
    setWorkingFileId,
  ] =
    useState<
      string | null
    >(null);

  const [
    moveMenuFileId,
    setMoveMenuFileId,
  ] =
    useState<
      string | null
    >(null);

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
      ] =
        await Promise.all([
          fetch(
            `/api/files?scope=all&t=${Date.now()}`,
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            `/api/admin/users?t=${Date.now()}`,
            {
              cache:
                "no-store",
            }
          ),
        ]);

      if (
        filesResponse.ok
      ) {
        const json =
          await filesResponse.json();

        setFiles(
          Array.isArray(
            json.files
          )
            ? json.files
            : []
        );
      }

      if (
        usersResponse.ok
      ) {
        const json =
          await usersResponse.json();

        setUsers(
          Array.isArray(
            json.users
          )
            ? json.users
            : []
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Failed to load admin files page:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadLogicalFolders() {
    setLoadingLogicalFolders(
      true
    );

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
        setLogicalFolders(
          []
        );

        return;
      }

      setLogicalFolders(
        Array.isArray(
          json.folders
        )
          ? json.folders
          : []
      );
    } finally {
      setLoadingLogicalFolders(
        false
      );
    }
  }

  async function loadFoldersForUser(
    userId: string
  ) {
    if (!userId) {
      setFolders([]);
      setCurrentFolderId(
        null
      );
      return;
    }

    setLoadingFolders(
      true
    );

    try {
      const response =
        await fetch(
          `/api/pdf-folders?userId=${encodeURIComponent(
            userId
          )}&t=${Date.now()}`,
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
        setFolders([]);
        return;
      }

      const nextFolders:
        FolderRow[] =
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
          if (!current) {
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

      setMoveMenuFileId(
        null
      );
    } finally {
      setLoadingFolders(
        false
      );
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
            user.role !==
            "ADMIN"
        ),
      [users]
    );

  const activeUsers =
    useMemo(
      () =>
        normalUsers.filter(
          (user) =>
            user.status ===
            "ACTIVE"
        ),
      [normalUsers]
    );

  const filteredUploadUsers =
    useMemo(() => {
      const q =
        newUserSearch
          .trim()
          .toLocaleLowerCase(
            "el"
          );

      if (!q) {
        return activeUsers;
      }

      return activeUsers.filter(
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
      activeUsers,
      newUserSearch,
    ]);

  const selectedPdfExplorerUser =
    useMemo(() => {
      if (
        !selectedPdfUserId
      ) {
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
            !isExcelFile(
              file
            ) &&
            !isPdfFile(
              file
            )
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
        uploadTargetUserIds.length ===
          0
      ) {
        return [];
      }

      return logicalFolders.filter(
        (folder) => {
          const ownerIds =
            new Set(
              folder.users.map(
                (user) =>
                  user.id
              )
            );

          return uploadTargetUserIds.every(
            (userId) =>
              ownerIds.has(
                userId
              )
          );
        }
      );
    }, [
      selectedFileIsPdf,
      uploadTargetUserIds,
      logicalFolders,
    ]);

  useEffect(() => {
    if (
      !newPdfFolderName
    ) {
      return;
    }

    const stillAvailable =
      availableUploadFolders.some(
        (folder) =>
          folder.name ===
          newPdfFolderName
      );

    if (
      !stillAvailable
    ) {
      setNewPdfFolderName(
        ""
      );
    }
  }, [
    availableUploadFolders,
    newPdfFolderName,
  ]);

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

  const selectedUserPdfFiles =
    useMemo(() => {
      if (
        !selectedPdfUserId
      ) {
        return [];
      }

      return pdfFiles.filter(
        (file) => {
          const assignments =
            file.assignments ||
            [];

          const assigned =
            assignments.some(
              (assignment) =>
                assignment.user.id ===
                  selectedPdfUserId ||
                assignment.userId ===
                  selectedPdfUserId
            );

          const legacyOwnUpload =
            assignments.length ===
              0 &&
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
          .toLocaleLowerCase(
            "el"
          );

      let source:
        FileRow[] = [];

      if (
        activeTab ===
        "EXCEL"
      ) {
        source =
          excelFiles;
      } else if (
        activeTab ===
        "OTHER"
      ) {
        source =
          otherFiles;
      } else if (
        pdfViewMode ===
        "ALL_FILES"
      ) {
        source =
          pdfFiles;
      } else {
        if (
          !selectedPdfUserId
        ) {
          return [];
        }

        if (
          currentFolder
        ) {
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
          const title = (
            file.title || ""
          ).toLocaleLowerCase(
            "el"
          );

          const originalName = (
            file.originalName ||
            ""
          ).toLocaleLowerCase(
            "el"
          );

          const assignedText =
            (
              file.assignments ||
              []
            )
              .map(
                (
                  assignment
                ) =>
                  `${
                    assignment
                      .user.email
                  } ${
                    assignment
                      .user
                      .name || ""
                  }`
              )
              .join(" ")
              .toLocaleLowerCase(
                "el"
              );

          return (
            title.includes(q) ||
            originalName.includes(
              q
            ) ||
            assignedText.includes(
              q
            )
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
        activeTab !==
          "PDF" ||
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
    return current.includes(
      id
    )
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
    setCurrentFolderId(
      null
    );
    setMoveMenuFileId(
      null
    );
    setQuery("");
  }

  function changePdfViewMode(
    mode: PdfViewMode
  ) {
    setPdfViewMode(mode);
    setCurrentFolderId(
      null
    );
    setMoveMenuFileId(
      null
    );
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
    setSelectedPdfUserId(
      userId
    );

    setCurrentFolderId(
      null
    );

    setMoveMenuFileId(
      null
    );

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
    setAssignmentMode(
      mode
    );

    setNewPdfFolderName(
      ""
    );

    if (
      selectedFileIsPdf
    ) {
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
          getApiError(
            json,
            "Αποτυχία δημιουργίας αρχείου"
          )
        );
      }

      setNewTitle("");
      setNewFile(null);
      setNewPdfFolderName(
        ""
      );
      setNewSelectedUserIds(
        []
      );
      setNewUserSearch("");
      setAssignmentMode(
        "SELECTED"
      );

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
        activeTab ===
          "PDF" &&
        pdfViewMode ===
          "USER_FOLDERS" &&
        selectedPdfUserId
      ) {
        await loadFoldersForUser(
          selectedPdfUserId
        );
      }
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Σφάλμα"
      );
    } finally {
      setSavingNew(
        false
      );
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
      userIds.length ===
      0
    ) {
      alert(
        "Επιλέξτε τουλάχιστον έναν χρήστη."
      );

      return;
    }

    setWorkingFileId(
      fileId
    );

    try {
      const response =
        await fetch(
          "/api/assignments",
          {
            method:
              "POST",

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
          .catch(
            () => ({})
          );

      if (
        !response.ok
      ) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία ανάθεσης"
        );
      }

      setAssignmentSelections(
        (previous) => ({
          ...previous,

          [fileId]:
            [],
        })
      );

      await load();
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία ανάθεσης"
      );
    } finally {
      setWorkingFileId(
        null
      );
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

    setWorkingFileId(
      fileId
    );

    try {
      const response =
        await fetch(
          "/api/assignments",
          {
            method:
              "POST",

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
          .catch(
            () => ({})
          );

      if (
        !response.ok
      ) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία ανάθεσης"
        );
      }

      await load();
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία ανάθεσης"
      );
    } finally {
      setWorkingFileId(
        null
      );
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
      userIds.length ===
      0
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

    setWorkingFileId(
      fileId
    );

    try {
      const response =
        await fetch(
          `/api/admin/files/${fileId}`,
          {
            method:
              "DELETE",

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
          .catch(
            () => ({})
          );

      if (
        !response.ok
      ) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία αφαίρεσης αναθέσεων"
        );
      }

      setRemovalSelections(
        (previous) => ({
          ...previous,

          [fileId]:
            [],
        })
      );

      await load();
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία αφαίρεσης αναθέσεων"
      );
    } finally {
      setWorkingFileId(
        null
      );
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

    setWorkingFileId(
      fileId
    );

    try {
      const response =
        await fetch(
          `/api/admin/files/${fileId}`,
          {
            method:
              "DELETE",

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
          .catch(
            () => ({})
          );

      if (
        !response.ok
      ) {
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
              file.id !==
              fileId
          )
      );

      if (
        manageFileId ===
        fileId
      ) {
        setManageFileId(
          null
        );
      }

      if (
        moveMenuFileId ===
        fileId
      ) {
        setMoveMenuFileId(
          null
        );
      }
    } catch (
      error: any
    ) {
      alert(
        error?.message ||
          "Αποτυχία διαγραφής αρχείου"
      );
    } finally {
      setWorkingFileId(
        null
      );
    }
  }

  async function movePdf(
    fileId: string,
    folderId:
      | string
      | null
  ) {
    if (
      !selectedPdfUserId
    ) {
      alert(
        "Επιλέξτε πρώτα χρήστη."
      );

      return;
    }

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

              userId:
                selectedPdfUserId,
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
        getApiError(
          json,
          "Αποτυχία μετακίνησης PDF."
        )
      );

      return;
    }

    setMoveMenuFileId(
      null
    );

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

    setCleaningDuplicates(
      true
    );

    try {
      const response =
        await fetch(
          "/api/admin/files/cleanup-duplicates",
          {
            method:
              "POST",
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
          json?.error ||
            "Αποτυχία καθαρισμού duplicates"
        );
      }

      alert(
        `Ο έλεγχος ολοκληρώθηκε.\nΒρέθηκαν groups: ${
          json.groupsFound ??
          0
        }\nΔιαγράφηκαν αρχεία: ${
          json.deletedFiles ??
          0
        }`
      );

      await load();
    } finally {
      setCleaningDuplicates(
        false
      );
    }
  }

  async function checkMissingStorage() {
    setCheckingMissing(
      true
    );

    try {
      const response =
        await fetch(
          "/api/admin/files/check-missing-storage",
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
          json?.detail ||
            json?.error ||
            "Αποτυχία ελέγχου storage"
        );
      }

      if (
        !json.missingCount
      ) {
        alert(
          `Ο έλεγχος ολοκληρώθηκε.\nΔεν βρέθηκαν missing αρχεία.\nΣύνολο checked: ${json.totalChecked}`
        );
      } else {
        alert(
          `Ο έλεγχος ολοκληρώθηκε.\nΣύνολο checked: ${json.totalChecked}\nMissing αρχεία: ${json.missingCount}`
        );
      }
    } finally {
      setCheckingMissing(
        false
      );
    }
  }

  async function cleanupMissingStorage() {
    if (
      !confirm(
        "Να διαγραφούν από τη βάση όλα τα αρχεία που λείπουν από το Supabase Storage;"
      )
    ) {
      return;
    }

    setCleaningMissing(
      true
    );

    try {
      const response =
        await fetch(
          "/api/admin/files/cleanup-missing-storage",
          {
            method:
              "POST",
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
          json?.detail ||
            json?.error ||
            "Αποτυχία cleanup missing files"
        );
      }

      alert(
        `Ο καθαρισμός ολοκληρώθηκε.\nMissing found: ${
          json.missingFound ??
          0
        }\nDeleted files: ${
          json.deletedFiles ??
          0
        }`
      );

      await load();
    } finally {
      setCleaningMissing(
        false
      );
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
        <h2 className="text-lg font-semibold">
          Προσθήκη νέου αρχείου
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Επιλέξτε όσους χρήστες θέλετε. Για PDF εμφανίζονται μόνο οι φάκελοι που υπάρχουν σε όλους τους επιλεγμένους χρήστες.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <input
              value={
                newTitle
              }
              onChange={(
                event
              ) =>
                setNewTitle(
                  event.target.value
                )
              }
              placeholder="Τίτλος αρχείου"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
            />

            <input
              id="admin-manual-file-input"
              type="file"
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
              onChange={(
                event
              ) => {
                const selectedFile =
                  event.currentTarget
                    .files?.[0] ||
                  null;

                setNewFile(
                  selectedFile
                );

                setNewPdfFolderName(
                  ""
                );

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

                if (
                  selectedFile &&
                  (
                    selectedFile.type ===
                      "application/pdf" ||
                    selectedFile.name
                      .toLowerCase()
                      .endsWith(
                        ".pdf"
                      )
                  )
                ) {
                  void loadLogicalFolders();
                }
              }}
            />

            {selectedFileIsPdf && (
              <div className="rounded-xl border bg-gray-50 p-3">
                <div className="text-sm font-medium">
                  Φάκελος τεκμηρίωσης
                </div>

                {uploadTargetUserIds.length ===
                0 ? (
                  <div className="mt-3 text-sm text-gray-500">
                    Επιλέξτε πρώτα τους χρήστες.
                  </div>
                ) : (
                  <select
                    value={
                      newPdfFolderName
                    }
                    onChange={(
                      event
                    ) =>
                      setNewPdfFolderName(
                        event.target.value
                      )
                    }
                    className="mt-3 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="">
                      Χωρίς φάκελο
                    </option>

                    {availableUploadFolders.map(
                      (
                        folder
                      ) => (
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
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-gray-50 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5">
                <input
                  type="radio"
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

                Επιλεγμένοι χρήστες
              </label>

              <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5">
                <input
                  type="radio"
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

                Όλοι οι ενεργοί
              </label>
            </div>

            {assignmentMode ===
              "SELECTED" && (
              <>
                <div className="mt-3 flex justify-between text-xs">
                  <span>
                    {
                      newSelectedUserIds.length
                    }
                    {" / "}
                    {
                      activeUsers.length
                    }{" "}
                    επιλεγμένοι
                  </span>

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
                    className="text-blue-700"
                  >
                    Επιλογή όλων
                  </button>
                </div>

                <input
                  value={
                    newUserSearch
                  }
                  onChange={(
                    event
                  ) =>
                    setNewUserSearch(
                      event.target.value
                    )
                  }
                  placeholder="Αναζήτηση χρήστη..."
                  className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />

                <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border bg-white p-2">
                  {filteredUploadUsers.map(
                    (
                      user
                    ) => (
                      <label
                        key={
                          user.id
                        }
                        className="flex gap-2 rounded-lg px-2 py-2 hover:bg-gray-50"
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
                        />

                        <span>
                          {
                            user.email
                          }
                        </span>
                      </label>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={
            createManual
          }
          disabled={
            savingNew
          }
          className="mt-4 rounded-xl bg-[color:var(--brand,#25C3F4)] px-4 py-3 font-semibold text-black disabled:opacity-50"
        >
          <Upload
            size={18}
            className="mr-2 inline"
          />

          {savingNew
            ? "Αποθήκευση..."
            : "Προσθήκη αρχείου"}
        </button>
      </section>

      <section className="rounded-2xl border bg-white">
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
            Excel
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
            PDF
          </TabButton>
        </div>

        {activeTab ===
          "PDF" && (
          <div className="border-b p-3">
            <div className="flex gap-2">
              <button
                onClick={() =>
                  changePdfViewMode(
                    "ALL_FILES"
                  )
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Όλα τα PDF
              </button>

              <button
                onClick={() =>
                  changePdfViewMode(
                    "USER_FOLDERS"
                  )
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Φάκελοι ανά χρήστη
              </button>
            </div>
          </div>
        )}

        {activeTab ===
          "PDF" &&
          pdfViewMode ===
            "USER_FOLDERS" && (
          <div className="border-b p-3">
            <select
              value={
                selectedPdfUserId
              }
              onChange={(
                event
              ) =>
                changePdfExplorerUser(
                  event.target.value
                )
              }
              className="w-full max-w-md rounded-xl border px-3 py-2"
            >
              <option value="">
                Επιλέξτε χρήστη...
              </option>

              {normalUsers.map(
                (
                  user
                ) => (
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
                  </option>
                )
              )}
            </select>
          </div>
        )}

        <div className="border-b p-3">
          <input
            value={
              query
            }
            onChange={(
              event
            ) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="Αναζήτηση αρχείου ή χρήστη..."
            className="w-full max-w-lg rounded-xl border px-3 py-2"
          />
        </div>

        <div className="grid min-h-[420px] grid-cols-2 gap-4 p-4 md:grid-cols-4 lg:grid-cols-6">
          {visibleFolders.map(
            (
              folder
            ) => (
              <button
                key={
                  folder.id
                }
                onClick={() =>
                  setCurrentFolderId(
                    folder.id
                  )
                }
                className="flex flex-col items-center"
              >
                <Folder
                  size={60}
                  className="text-amber-500"
                />

                <span className="mt-2 text-sm">
                  {
                    folder.name
                  }
                </span>
              </button>
            )
          )}

          {visibleFiles.map(
            (
              file
            ) => (
              <AdminFileCard
                key={
                  file.id
                }
                file={
                  file
                }
                folders={
                  folders
                }
                isPdf={isPdfFile(
                  file
                )}
                isExcel={isExcelFile(
                  file
                )}
                currentPdfFolderId={
                  selectedPdfUserId
                    ? getPdfFolderIdForUser(
                        file,
                        selectedPdfUserId
                      )
                    : null
                }
                allowPdfMove={
                  !!selectedPdfUserId &&
                  pdfViewMode ===
                    "USER_FOLDERS"
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
            )
          )}
        </div>
      </section>

      <details className="rounded-2xl border bg-white">
        <summary className="px-4 py-3">
          <Settings
            size={17}
            className="mr-2 inline"
          />

          Εργαλεία διαχειριστή
        </summary>

        <div className="flex gap-2 border-t p-4">
          <button
            onClick={
              checkMissingStorage
            }
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Έλεγχος storage
          </button>

          <button
            onClick={
              cleanupMissingStorage
            }
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Καθαρισμός broken files
          </button>

          <button
            onClick={
              cleanupDuplicates
            }
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Έλεγχος duplicates
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
          onToggleAssign={(
            userId
          ) =>
            setAssignmentSelections(
              (
                previous
              ) => ({
                ...previous,

                [managingFile.id]:
                  toggleId(
                    previous[
                      managingFile.id
                    ] ||
                      [],
                    userId
                  ),
              })
            )
          }
          onToggleRemove={(
            userId
          ) =>
            setRemovalSelections(
              (
                previous
              ) => ({
                ...previous,

                [managingFile.id]:
                  toggleId(
                    previous[
                      managingFile.id
                    ] ||
                      [],
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
      className="rounded-lg border px-3 py-2 text-sm"
    >
      {icon}
      <span className="ml-2">
        {children}
      </span>
    </button>
  );
}

function AdminFileCard({
  file,
  folders,
  isPdf,
  isExcel,
  currentPdfFolderId,
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
  allowPdfMove: boolean;
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
  return (
    <div className="group relative text-center">
      {isExcel ? (
        <FileSpreadsheet
          size={58}
          className="mx-auto text-emerald-600"
        />
      ) : isPdf ? (
        <FileText
          size={58}
          className="mx-auto text-red-600"
        />
      ) : (
        <FileIcon
          size={58}
          className="mx-auto text-gray-500"
        />
      )}

      <div className="mt-2 text-sm">
        {
          file.title
        }
      </div>

      <div className="mt-1 text-xs text-gray-500">
        {
          file.assignments
            ?.length || 0
        }{" "}
        ανάθεση(εις)
      </div>

      <div className="mt-2 flex justify-center gap-1">
        <button
          onClick={
            onManage
          }
          className="rounded border p-1.5"
        >
          <Users
            size={15}
          />
        </button>

        {isPdf &&
          allowPdfMove && (
          <button
            onClick={() =>
              setMoveMenuFileId(
                moveMenuFileId ===
                  file.id
                  ? null
                  : file.id
              )
            }
            className="rounded border p-1.5"
          >
            <Folder
              size={15}
            />
          </button>
        )}

        <button
          disabled={
            working
          }
          onClick={
            onDelete
          }
          className="rounded border p-1.5 text-red-600"
        >
          <Trash2
            size={15}
          />
        </button>
      </div>

      {moveMenuFileId ===
        file.id && (
        <div className="absolute z-50 mt-2 w-56 rounded border bg-white p-2 shadow">
          <button
            onClick={() =>
              void onMovePdf(
                file.id,
                null
              )
            }
            className="block w-full p-2 text-left text-sm"
          >
            Χωρίς φάκελο
          </button>

          {folders.map(
            (
              folder
            ) => (
              <button
                key={
                  folder.id
                }
                onClick={() =>
                  void onMovePdf(
                    file.id,
                    folder.id
                  )
                }
                className="block w-full p-2 text-left text-sm"
              >
                {
                  folder.name
                }
              </button>
            )
          )}
        </div>
      )}
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
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-3">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4">
        <div className="flex justify-between">
          <h2 className="font-semibold">
            Αναθέσεις PDF
          </h2>

          <button
            onClick={
              onClose
            }
          >
            Κλείσιμο
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {(file.assignments ||
            []).map(
            (
              assignment
            ) => (
              <div
                key={
                  assignment.id ||
                  assignment
                    .user.id
                }
                className="rounded border p-3"
              >
                <div className="font-medium">
                  {
                    assignment
                      .user.email
                  }
                </div>

                <div className="text-xs text-gray-500">
                  {assignment
                    .pdfFolder
                    ?.name ||
                    "Χωρίς φάκελο"}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function AssignmentModal(
  props: any
) {
  return null;
}