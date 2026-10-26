"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Folder,
  FileText,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

type BusinessType =
  | "RESTAURANT_GRILL"
  | "RESTAURANT_GRILL_HYGIENE_WITH_COFFEE"
  | "BAR_WINE"
  | "REFRESHMENT_CAFE"
  | "SCHOOL_KIOSK"
  | "PASTRY_SHOP_WITH_COFFEE"
  | "PASTRY_SHOP_NO_COFFEE"
  | "BREAD_SHOP_WITH_COFFEE"
  | "BUTCHER"
  | "BUTCHER_HOT_CORNER"
  | "FISHMONGER"
  | "FISHMONGER_HOT_CORNER"
  | "DELI_CHEESE_CURED_MEAT"
  | "BAKERY_WITH_COFFEE"
  | "BAKERY_NO_COFFEE"
  | "BAKERY_PASTRY_WITH_COFFEE"
  | "PASTRY_WITH_COFFEE"
  | "PASTRY_NO_COFFEE"
  | "GROCERY_FRUIT"
  | "WINE_NUTS_SHOP"
  | "FROZEN_PRODUCTS_SHOP"
  | "PACKAGED_FRESH_FROZEN_DRY"
  | "ICE_CREAM_SHOP"
  | "PUFF_PASTRY_PRODUCTION";

type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

type PublicHoliday =
  | "NEW_YEAR"
  | "THEOPHANY_JAN_6"
  | "CLEAN_MONDAY"
  | "MARCH_25"
  | "EASTER_SUNDAY"
  | "EASTER_MONDAY"
  | "AUG_15"
  | "OCT_28"
  | "CHRISTMAS"
  | "BOXING_DAY"
  | "MAY_1";

type ProfilePayload = {
  businessName: string;
  addressStreet: string;
  businessTypes: BusinessType[];

  fridgeCount: number;
  freezerCount: number;
  hotCabinetCount: number;
  dryAgedChamberCount: number;
  iceCreamFreezerCount: number;
  chocolateDisplayCount: number;
  supervisorInitials: string;

  closedWeekdays: Weekday[];
  closedHolidays: PublicHoliday[];

  augustRange: {
    from: string;
    to: string;
  };
};

type AdminUserMeta = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  role: string;
};

type FolderItem = {
  id: string;
  name: string;
  ownerId?: string | null;
};

type FileAssignmentItem = {
  id?: string;
  userId?: string;

  pdfFolderId?: string | null;

  pdfFolder?: FolderItem | null;

  user: {
    id: string;
    email: string;
    name?: string | null;
  };
};

type FileItem = {
  id: string;

  title: string;

  originalName?: string | null;

  createdAt: string | Date;

  size?: number | null;

  url?: string | null;

  mime?: string | null;

  /*
   * IMPORTANT:
   *
   * Inside this page we normalize this value
   * so it always represents the folder of the
   * selected profile user.
   */
  pdfFolderId?: string | null;

  pdfFolder?: FolderItem | null;

  uploadedBy?: {
    id: string;
    email: string;
    name?: string | null;
  } | null;

  assignments?: FileAssignmentItem[];
};

const BUSINESS_TYPES_LABELS: Record<
  BusinessType,
  string
> = {
  RESTAURANT_GRILL:
    "Εστιατόριο - Ψητοπωλείο",

  RESTAURANT_GRILL_HYGIENE_WITH_COFFEE:
    "Εστιατόριο - Ψητοπωλείο με παροχή καφέ",

  BAR_WINE:
    "Bar – Wine Bar",

  REFRESHMENT_CAFE:
    "Αναψυκτήριο – καφετέρια",

  SCHOOL_KIOSK:
    "Σχολικό κυλικείο",

  PASTRY_SHOP_WITH_COFFEE:
    "Πρατήριο ζαχ/κής - γάλακτος με παροχή καφέ",

  PASTRY_SHOP_NO_COFFEE:
    "Πρατήριο ζαχ/κής χωρίς παροχή καφέ",

  BREAD_SHOP_WITH_COFFEE:
    "Πρατήριο άρτου με παροχή καφέ",

  BUTCHER:
    "Κρεοπωλείο",

  BUTCHER_HOT_CORNER:
    "Κρεοπωλείο με ζεστή γωνιά",

  FISHMONGER:
    "Ιχθυοπωλείο",

  FISHMONGER_HOT_CORNER:
    "Ιχθυοπωλείο με ζεστή γωνιά",

  DELI_CHEESE_CURED_MEAT:
    "Διάθεση προϊόντων αλλαντοποιίας / τυροκομίας",

  BAKERY_WITH_COFFEE:
    "Αρτοποιείο με παροχή καφέ",

  BAKERY_NO_COFFEE:
    "Αρτοποιείο χωρίς παροχή καφέ",

  BAKERY_PASTRY_WITH_COFFEE:
    "Αρτοποιείο – Ζαχαροπλαστείο με παροχή καφέ",

  PASTRY_WITH_COFFEE:
    "Ζαχαροπλαστείο με παροχή καφέ",

  PASTRY_NO_COFFEE:
    "Ζαχαροπλαστείο χωρίς παροχή καφέ",

  GROCERY_FRUIT:
    "Παντοπωλείο / οπωροπωλείο",

  WINE_NUTS_SHOP:
    "Κάβα / κατάστημα ξηρών καρπών",

  FROZEN_PRODUCTS_SHOP:
    "Πρατήριο κατεψυγμένων προϊόντων",

  PACKAGED_FRESH_FROZEN_DRY:
    "Συσκευασμένα προϊόντα νωπά/κατεψυγμένα/ξηρού φορτίου",

  ICE_CREAM_SHOP:
    "Παγωτοπωλείο",

  PUFF_PASTRY_PRODUCTION:
    "Παρασκευή – πώληση σφολιατοειδών προϊόντων",
};

const WEEKDAY_LABELS: Record<
  Weekday,
  string
> = {
  MONDAY: "Δευτέρα",
  TUESDAY: "Τρίτη",
  WEDNESDAY: "Τετάρτη",
  THURSDAY: "Πέμπτη",
  FRIDAY: "Παρασκευή",
  SATURDAY: "Σάββατο",
  SUNDAY: "Κυριακή",
};

const HOLIDAY_LABELS: Record<
  PublicHoliday,
  string
> = {
  NEW_YEAR:
    "01/01 (Πρωτοχρονιά)",

  THEOPHANY_JAN_6:
    "06/01 (Θεοφάνεια)",

  CLEAN_MONDAY:
    "Καθαρά Δευτέρα",

  MARCH_25:
    "25/03 (Εθνική εορτή)",

  EASTER_SUNDAY:
    "Κυριακή του Πάσχα",

  EASTER_MONDAY:
    "Δευτέρα του Πάσχα",

  AUG_15:
    "15/08 (Κοίμηση Θεοτόκου)",

  OCT_28:
    "28/10 (Εθνική εορτή)",

  CHRISTMAS:
    "25/12 (Χριστούγεννα)",

  BOXING_DAY:
    "26/12 (Επίσημη αργία)",

  MAY_1:
    "01/05 (Εργατική Πρωτομαγιά)",
};

function isPdfFile(
  file: FileItem
) {
  const mime =
    (
      file.mime ||
      ""
    ).toLowerCase();

  const name =
    (
      file.originalName ||
      ""
    ).toLowerCase();

  const title =
    (
      file.title ||
      ""
    ).toLowerCase();

  return (
    mime.includes(
      "pdf"
    ) ||
    name.endsWith(
      ".pdf"
    ) ||
    name.includes(
      ".pdf"
    ) ||
    title.endsWith(
      ".pdf"
    ) ||
    title.includes(
      ".pdf"
    )
  );
}

function isPdfUpload(
  file: File | null
) {
  if (!file) {
    return false;
  }

  return (
    file.type ===
      "application/pdf" ||
    file.name
      .toLowerCase()
      .endsWith(
        ".pdf"
      )
  );
}

function formatSize(
  bytes:
    | number
    | null
    | undefined
) {
  if (
    !bytes ||
    bytes <= 0
  ) {
    return "—";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  let index = 0;

  let value = bytes;

  while (
    value >= 1024 &&
    index <
      units.length - 1
  ) {
    value /= 1024;
    index++;
  }

  return `${value.toFixed(
    value < 10 &&
      index > 0
      ? 1
      : 0
  )} ${units[index]}`;
}

function cleanUploadedFilename(
  name: string
) {
  return name
    .replace(
      /\.[^/.]+$/,
      ""
    )
    .replace(
      /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}__?/i,
      ""
    );
}

export default function AdminUserProfilePage() {
  const params =
    useParams<{
      id: string;
    }>();

  const userId =
    params?.id;

  const [
    user,
    setUser,
  ] =
    useState<
      AdminUserMeta | null
    >(null);

  const [
    profile,
    setProfile,
  ] =
    useState<
      ProfilePayload | null
    >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    okMessage,
    setOkMessage,
  ] =
    useState<
      string | null
    >(null);

  /*
   * Password reset
   */
  const [
    pw,
    setPw,
  ] = useState({
    newPassword: "",
    confirm: "",
  });

  const [
    pwSaving,
    setPwSaving,
  ] = useState(false);

  const [
    pwMsg,
    setPwMsg,
  ] =
    useState<
      string | null
    >(null);

  const [
    pwErr,
    setPwErr,
  ] =
    useState<
      string | null
    >(null);

  /*
   * Files modal
   */
  const [
    filesOpen,
    setFilesOpen,
  ] = useState(false);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    allFiles,
    setAllFiles,
  ] =
    useState<
      FileItem[]
    >([]);

  const [
    folders,
    setFolders,
  ] =
    useState<
      FolderItem[]
    >([]);

  const [
    folderFilter,
    setFolderFilter,
  ] =
    useState<string>(
      "ALL"
    );

  const [
    loadingFiles,
    setLoadingFiles,
  ] = useState(false);

  const [
    loadingFolders,
    setLoadingFolders,
  ] = useState(false);

  const [
    creatingFolder,
    setCreatingFolder,
  ] = useState(false);

  /*
   * Upload
   */
  const [
    upTitle,
    setUpTitle,
  ] = useState("");

  const [
    upFile,
    setUpFile,
  ] =
    useState<
      File | null
    >(null);

  const [
    upPdfFolderId,
    setUpPdfFolderId,
  ] = useState("");

  const [
    uploading,
    setUploading,
  ] = useState(false);

  /*
   * Delete
   */
  const [
    deletingId,
    setDeletingId,
  ] =
    useState<
      string | null
    >(null);

  /*
   * -------------------------------------------------------
   * LOAD PROFILE
   * -------------------------------------------------------
   */
  useEffect(() => {
    if (!userId) {
      return;
    }

    (async () => {
      setLoading(true);

      setError(
        null
      );

      try {
        const res =
          await fetch(
            `/api/admin/users/${userId}/profile`,
            {
              cache:
                "no-store",
            }
          );

        const json =
          await res.json();

        if (!res.ok) {
          throw new Error(
            json?.error ||
              "Αποτυχία φόρτωσης προφίλ"
          );
        }

        const u =
          json.user as AdminUserMeta;

        const p =
          json.profile as
            | any
            | null;

        setUser(
          u
        );

        if (!p) {
          setProfile({
            businessName:
              "",

            addressStreet:
              "",

            businessTypes:
              [],

            fridgeCount:
              0,

            freezerCount:
              0,

            hotCabinetCount:
              0,

            dryAgedChamberCount:
              0,

            iceCreamFreezerCount:
              0,

            chocolateDisplayCount:
              0,

            supervisorInitials:
              "",

            closedWeekdays:
              [],

            closedHolidays:
              [],

            augustRange: {
              from: "",
              to: "",
            },
          });
        } else {
          setProfile({
            businessName:
              p.businessName ??
              "",

            addressStreet:
              p.addressStreet ??
              "",

            businessTypes:
              (
                p.businessTypes ??
                []
              ) as BusinessType[],

            fridgeCount:
              p.fridgeCount ??
              0,

            freezerCount:
              p.freezerCount ??
              0,

            hotCabinetCount:
              p.hotCabinetCount ??
              0,

            dryAgedChamberCount:
              p.dryAgedChamberCount ??
              0,

            iceCreamFreezerCount:
              p.iceCreamFreezerCount ??
              0,

            chocolateDisplayCount:
              p.chocolateDisplayCount ??
              0,

            supervisorInitials:
              p.supervisorInitials ??
              "",

            closedWeekdays:
              (
                p.closedWeekdays ??
                []
              ) as Weekday[],

            closedHolidays:
              (
                p.closedHolidays ??
                []
              ) as PublicHoliday[],

            augustRange: {
              from:
                p.augustRange
                  ?.from ||
                "",

              to:
                p.augustRange
                  ?.to ||
                "",
            },
          });
        }
      } catch (
        err: any
      ) {
        setError(
          err.message ||
            "Αποτυχία φόρτωσης προφίλ"
        );
      } finally {
        setLoading(
          false
        );
      }
    })();
  }, [userId]);

  /*
   * Lock body while modal is open.
   */
  useEffect(() => {
    if (!filesOpen) {
      return;
    }

    const previous =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previous;
    };
  }, [filesOpen]);

  function update<
    K extends keyof ProfilePayload
  >(
    key: K,
    value: ProfilePayload[K]
  ) {
    if (!profile) {
      return;
    }

    setProfile({
      ...profile,
      [key]: value,
    });
  }

  /*
   * -------------------------------------------------------
   * SAVE PROFILE
   * -------------------------------------------------------
   */
  async function save() {
    if (
      !profile ||
      !userId
    ) {
      return;
    }

    setSaving(
      true
    );

    setError(
      null
    );

    setOkMessage(
      null
    );

    try {
      const res =
        await fetch(
          `/api/admin/users/${userId}/profile`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                profile
              ),
          }
        );

      const json =
        await res
          .json()
          .catch(
            () => ({})
          );

      if (!res.ok) {
        throw new Error(
          json?.error ||
            "Αποτυχία αποθήκευσης"
        );
      }

      setOkMessage(
        "Το προφίλ αποθηκεύτηκε."
      );
    } catch (
      err: any
    ) {
      setError(
        err.message ||
          "Αποτυχία αποθήκευσης"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /*
   * -------------------------------------------------------
   * RESET PASSWORD
   * -------------------------------------------------------
   */
  async function resetPassword() {
    if (!userId) {
      return;
    }

    setPwMsg(
      null
    );

    setPwErr(
      null
    );

    if (
      pw.newPassword.length <
      6
    ) {
      setPwErr(
        "Ο νέος κωδικός πρέπει να είναι τουλάχιστον 6 χαρακτήρες."
      );

      return;
    }

    if (
      pw.newPassword !==
      pw.confirm
    ) {
      setPwErr(
        "Η επιβεβαίωση κωδικού δεν ταιριάζει."
      );

      return;
    }

    setPwSaving(
      true
    );

    try {
      const res =
        await fetch(
          `/api/admin/users/${userId}/password`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                newPassword:
                  pw.newPassword,
              }),
          }
        );

      const json =
        await res
          .json()
          .catch(
            () => ({})
          );

      if (!res.ok) {
        throw new Error(
          json?.error ||
            "Αποτυχία αλλαγής κωδικού"
        );
      }

      setPwMsg(
        "Ο κωδικός ενημερώθηκε."
      );

      setPw({
        newPassword:
          "",

        confirm:
          "",
      });
    } catch (
      err: any
    ) {
      setPwErr(
        err.message ||
          "Αποτυχία αλλαγής κωδικού"
      );
    } finally {
      setPwSaving(
        false
      );
    }
  }

  /*
   * -------------------------------------------------------
   * LOAD FILES
   * -------------------------------------------------------
   *
   * IMPORTANT:
   *
   * GET /api/files?scope=all returns all assignments.
   *
   * We find THIS profile user's assignment and flatten
   * its pdfFolderId into the FileItem used by this view.
   *
   * Therefore shared PDFs show the correct folder for
   * the selected profile user.
   */
  async function refreshFiles() {
    if (!userId) {
      return;
    }

    setLoadingFiles(
      true
    );

    try {
      const res =
        await fetch(
          `/api/files?scope=all&t=${Date.now()}`,
          {
            cache:
              "no-store",
          }
        );

      const json =
        await res
          .json()
          .catch(
            () => ({})
          );

      if (!res.ok) {
        throw new Error(
          json?.error ||
            "Αποτυχία φόρτωσης αρχείων"
        );
      }

      const rows =
        (
          json.files ||
          []
        ) as FileItem[];

      const filtered =
        rows
          .filter(
            (
              file
            ) => {
              const assigned =
                (
                  file.assignments ||
                  []
                ).some(
                  (
                    assignment
                  ) =>
                    assignment
                      .user
                      .id ===
                      userId ||
                    assignment
                      .userId ===
                      userId
                );

              const uploadedBy =
                file.uploadedBy
                  ?.id ===
                userId;

              return (
                assigned ||
                uploadedBy
              );
            }
          )
          .map(
            (
              file
            ) => {
              const assignment =
                (
                  file.assignments ||
                  []
                ).find(
                  (
                    item
                  ) =>
                    item.user
                      .id ===
                      userId ||
                    item.userId ===
                      userId
                );

              /*
               * Assignment takes priority.
               *
               * Even if pdfFolderId is null,
               * null is intentional:
               * this user has the PDF loose.
               */
              if (
                assignment
              ) {
                return {
                  ...file,

                  pdfFolderId:
                    assignment.pdfFolderId ??
                    null,

                  pdfFolder:
                    assignment.pdfFolder ??
                    null,
                };
              }

              /*
               * Legacy fallback.
               */
              return file;
            }
          );

      setAllFiles(
        filtered
      );
    } catch (
      err
    ) {
      console.error(
        "Could not load user files:",
        err
      );
    } finally {
      setLoadingFiles(
        false
      );
    }
  }

  /*
   * -------------------------------------------------------
   * LOAD THIS USER'S PERSONAL FOLDERS
   * -------------------------------------------------------
   */
  async function loadFolders() {
    if (!userId) {
      return;
    }

    setLoadingFolders(
      true
    );

    try {
      const res =
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
        await res
          .json()
          .catch(
            () => ({})
          );

      if (res.ok) {
        const nextFolders =
          (
            json.folders ||
            []
          ) as FolderItem[];

        setFolders(
          nextFolders
        );

        /*
         * Prevent stale filter after folder removal.
         */
        setFolderFilter(
          (
            current
          ) => {
            if (
              current ===
                "ALL" ||
              current ===
                "NONE"
            ) {
              return current;
            }

            return nextFolders.some(
              (
                folder
              ) =>
                folder.id ===
                current
            )
              ? current
              : "ALL";
          }
        );

        /*
         * Prevent stale upload-folder selection.
         */
        setUpPdfFolderId(
          (
            current
          ) =>
            !current ||
            nextFolders.some(
              (
                folder
              ) =>
                folder.id ===
                current
            )
              ? current
              : ""
        );
      }
    } finally {
      setLoadingFolders(
        false
      );
    }
  }

  useEffect(() => {
    if (!filesOpen) {
      return;
    }

    void refreshFiles();

    void loadFolders();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filesOpen,
    userId,
  ]);

  /*
   * -------------------------------------------------------
   * UPLOAD TO THIS USER
   * -------------------------------------------------------
   */
  async function uploadToUser() {
    if (!userId) {
      return;
    }

    if (
      !upTitle.trim() ||
      !upFile
    ) {
      alert(
        "Συμπληρώστε τίτλο και επιλέξτε αρχείο."
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
        upTitle.trim()
      );

      formData.append(
        "file",
        upFile
      );

      /*
       * Only this profile user.
       */
      formData.append(
        "assignTo",
        userId
      );

      /*
       * PDF only:
       *
       * Physical personal folder ID of this user.
       */
      if (
        isPdfUpload(
          upFile
        ) &&
        upPdfFolderId
      ) {
        formData.append(
          "pdfFolderId",
          upPdfFolderId
        );
      }

      const res =
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
        await res
          .json()
          .catch(
            () => ({})
          );

      if (!res.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία upload"
        );
      }

      setUpTitle(
        ""
      );

      setUpFile(
        null
      );

      setUpPdfFolderId(
        ""
      );

      const input =
        document.getElementById(
          "admin-profile-user-file-input"
        ) as
          | HTMLInputElement
          | null;

      if (input) {
        input.value =
          "";
      }

      await refreshFiles();
    } catch (
      err: any
    ) {
      alert(
        err?.message ||
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
   * CREATE PERSONAL FOLDER FOR THIS USER
   * -------------------------------------------------------
   */
  async function createFolder() {
    if (!userId) {
      return;
    }

    const name =
      prompt(
        "Όνομα φακέλου (PDF):"
      )?.trim();

    if (!name) {
      return;
    }

    setCreatingFolder(
      true
    );

    try {
      const res =
        await fetch(
          "/api/pdf-folders",
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
                userId,
              }),
          }
        );

      const json =
        await res
          .json()
          .catch(
            () => ({})
          );

      if (!res.ok) {
        alert(
          json?.error ===
            "folder_exists"
            ? "Ο φάκελος υπάρχει ήδη."
            : json?.detail ||
                json?.error ||
                "Αποτυχία δημιουργίας φακέλου."
        );

        return;
      }

      await loadFolders();

      if (
        json.folder
          ?.id
      ) {
        setFolderFilter(
          json.folder.id
        );

        setUpPdfFolderId(
          json.folder.id
        );
      }
    } finally {
      setCreatingFolder(
        false
      );
    }
  }

  /*
   * -------------------------------------------------------
   * RENAME THIS USER'S PERSONAL FOLDER
   * -------------------------------------------------------
   */
  async function renameFolder(
    id: string,
    current: string
  ) {
    const name =
      prompt(
        "Νέο όνομα φακέλου:",
        current
      )?.trim();

    if (
      !name ||
      name === current
    ) {
      return;
    }

    const res =
      await fetch(
        `/api/pdf-folders/${id}`,
        {
          method:
            "PATCH",

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
      await res
        .json()
        .catch(
          () => ({})
        );

    if (!res.ok) {
      alert(
        json?.detail ||
          json?.error ||
          "Αποτυχία μετονομασίας."
      );

      return;
    }

    await Promise.all([
      loadFolders(),
      refreshFiles(),
    ]);
  }

  /*
   * -------------------------------------------------------
   * DELETE THIS USER'S PERSONAL FOLDER
   * -------------------------------------------------------
   *
   * PDFs are NOT deleted.
   *
   * Their assignment folder becomes null.
   */
  async function deleteFolder(
    id: string
  ) {
    if (
      !confirm(
        "Διαγραφή φακέλου; Τα PDF δεν θα διαγραφούν, απλώς θα εμφανίζονται χωρίς φάκελο για αυτόν τον χρήστη."
      )
    ) {
      return;
    }

    const res =
      await fetch(
        `/api/pdf-folders/${id}`,
        {
          method:
            "DELETE",
        }
      );

    const json =
      await res
        .json()
        .catch(
          () => ({})
        );

    if (!res.ok) {
      alert(
        json?.detail ||
          json?.error ||
          "Αποτυχία διαγραφής φακέλου."
      );

      return;
    }

    setFolderFilter(
      "ALL"
    );

    if (
      upPdfFolderId ===
      id
    ) {
      setUpPdfFolderId(
        ""
      );
    }

    await Promise.all([
      loadFolders(),
      refreshFiles(),
    ]);
  }

  /*
   * -------------------------------------------------------
   * MOVE PDF FOR THIS USER ONLY
   * -------------------------------------------------------
   */
  async function movePdf(
    fileId: string,
    pdfFolderId:
      | string
      | null
  ) {
    if (!userId) {
      return;
    }

    try {
      const res =
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
                pdfFolderId,

                /*
                 * CRITICAL:
                 *
                 * This identifies which assignment of
                 * a shared PDF we are moving.
                 */
                userId,
              }),
          }
        );

      const json =
        await res
          .json()
          .catch(
            () => ({})
          );

      if (!res.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία μετακίνησης PDF."
        );
      }

      /*
       * Update local view immediately.
       */
      setAllFiles(
        (
          previous
        ) =>
          previous.map(
            (
              file
            ) =>
              file.id ===
              fileId
                ? {
                    ...file,

                    pdfFolderId,

                    pdfFolder:
                      folders.find(
                        (
                          folder
                        ) =>
                          folder.id ===
                          pdfFolderId
                      ) ||
                      null,
                  }
                : file
          )
      );
    } catch (
      err: any
    ) {
      console.error(
        err
      );

      alert(
        err?.message ||
          "Αποτυχία μετακίνησης PDF."
      );
    }
  }

  /*
   * -------------------------------------------------------
   * REMOVE FILE FROM THIS USER
   * -------------------------------------------------------
   *
   * IMPORTANT:
   *
   * This does NOT necessarily delete the physical File.
   *
   * If a shared PDF belongs to multiple users,
   * only this user's FileAssignment is removed.
   */
  async function deleteFile(
    fileId: string
  ) {
    if (!userId) {
      return;
    }

    if (
      !confirm(
        "Να αφαιρεθεί το αρχείο από αυτόν τον χρήστη; Αν το αρχείο είναι κοινόχρηστο με άλλους χρήστες, δεν θα διαγραφεί από εκείνους."
      )
    ) {
      return;
    }

    setDeletingId(
      fileId
    );

    try {
      const res =
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
                userIds: [
                  userId,
                ],

                deleteEntireFile:
                  false,
              }),
          }
        );

      const json =
        await res
          .json()
          .catch(
            () => ({})
          );

      if (!res.ok) {
        throw new Error(
          json?.detail ||
            json?.error ||
            "Αποτυχία διαγραφής"
        );
      }

      setAllFiles(
        (
          previous
        ) =>
          previous.filter(
            (
              file
            ) =>
              file.id !==
              fileId
          )
      );
    } catch (
      err: any
    ) {
      alert(
        err?.message ||
          "Αποτυχία διαγραφής"
      );
    } finally {
      setDeletingId(
        null
      );
    }
  }

  /*
   * -------------------------------------------------------
   * FILTERS
   * -------------------------------------------------------
   */
  const filteredFiles =
    useMemo(() => {
      const q =
        query
          .trim()
          .toLocaleLowerCase(
            "el"
          );

      if (!q) {
        return allFiles;
      }

      return allFiles.filter(
        (
          file
        ) => {
          const title =
            (
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
      allFiles,
      query,
    ]);

  const {
    pdfs,
    others,
  } =
    useMemo(() => {
      const pdfRows =
        filteredFiles.filter(
          isPdfFile
        );

      const otherRows =
        filteredFiles.filter(
          (
            file
          ) =>
            !isPdfFile(
              file
            )
        );

      return {
        pdfs:
          pdfRows,

        others:
          otherRows,
      };
    }, [
      filteredFiles,
    ]);

  const pdfsFilteredByFolder =
    useMemo(() => {
      if (
        folderFilter ===
        "ALL"
      ) {
        return pdfs;
      }

      if (
        folderFilter ===
        "NONE"
      ) {
        return pdfs.filter(
          (
            file
          ) =>
            !file.pdfFolderId
        );
      }

      return pdfs.filter(
        (
          file
        ) =>
          file.pdfFolderId ===
          folderFilter
      );
    }, [
      pdfs,
      folderFilter,
    ]);

  if (
    loading ||
    !profile
  ) {
    return (
      <div className="p-6">
        <p className="text-sm text-[color:var(--muted)]">
          Φόρτωση…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            Προφίλ πελάτη
          </h1>

          {user && (
            <p className="truncate text-sm text-gray-500">
              {user.name ||
                "—"}{" "}
              ·{" "}
              {
                user.email
              }
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            setFilesOpen(
              true
            )
          }
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{
            backgroundColor:
              "var(--brand,#25C3F4)",

            color:
              "#061630",
          }}
        >
          Αρχεία χρήστη
        </button>
      </header>

      {/* MAIN PROFILE CARD */}
      <section className="space-y-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4 shadow-sm">
        {/* BASIC */}
        <div>
          <h2 className="mb-2 font-semibold">
            Βασικά στοιχεία
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-sm">
                Επωνυμία επιχείρησης
              </span>

              <input
                className="w-full rounded border p-2 text-sm"
                value={
                  profile.businessName
                }
                onChange={(
                  event
                ) =>
                  update(
                    "businessName",
                    event.target
                      .value
                  )
                }
              />
            </label>

            <label className="block">
              <span className="text-sm">
                Οδός, περιοχή, Τ.Κ.
              </span>

              <input
                className="w-full rounded border p-2 text-sm"
                placeholder="π.χ. Πατησίων 12"
                value={
                  profile.addressStreet
                }
                onChange={(
                  event
                ) =>
                  update(
                    "addressStreet",
                    event.target
                      .value
                  )
                }
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm">
                Αρχικά υπευθύνου καταγραφής
              </span>

              <input
                className="w-full rounded border p-2 text-sm"
                value={
                  profile.supervisorInitials
                }
                onChange={(
                  event
                ) =>
                  update(
                    "supervisorInitials",
                    event.target
                      .value
                  )
                }
              />
            </label>
          </div>
        </div>

        {/* BUSINESS TYPE */}
        <div>
          <h2 className="mb-2 font-semibold">
            Είδος επιχείρησης
          </h2>

          <div className="grid gap-2 md:grid-cols-2">
            {(
              Object.keys(
                BUSINESS_TYPES_LABELS
              ) as BusinessType[]
            ).map(
              (
                key
              ) => {
                const checked =
                  profile.businessTypes.includes(
                    key
                  );

                return (
                  <label
                    key={
                      key
                    }
                    className="flex items-center gap-2 rounded border p-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={
                        checked
                      }
                      onChange={(
                        event
                      ) => {
                        const set =
                          new Set(
                            profile.businessTypes
                          );

                        if (
                          event
                            .target
                            .checked
                        ) {
                          set.add(
                            key
                          );
                        } else {
                          set.delete(
                            key
                          );
                        }

                        update(
                          "businessTypes",
                          Array.from(
                            set
                          ) as BusinessType[]
                        );
                      }}
                    />

                    <span>
                      {
                        BUSINESS_TYPES_LABELS[
                          key
                        ]
                      }
                    </span>
                  </label>
                );
              }
            )}
          </div>
        </div>

        {/* EQUIPMENT */}
        <div>
          <h2 className="mb-2 font-semibold">
            Εξοπλισμός αποθήκευσης/διατήρησης τροφίμων
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <NumberField
              label="Αριθμός ψυγείων"
              value={
                profile.fridgeCount
              }
              onChange={(
                value
              ) =>
                update(
                  "fridgeCount",
                  value
                )
              }
            />

            <NumberField
              label="Αριθμός καταψύξεων"
              value={
                profile.freezerCount
              }
              onChange={(
                value
              ) =>
                update(
                  "freezerCount",
                  value
                )
              }
            />

            <NumberField
              label="Αριθμός θερμοθαλάμων / Bain Marie"
              value={
                profile.hotCabinetCount
              }
              onChange={(
                value
              ) =>
                update(
                  "hotCabinetCount",
                  value
                )
              }
            />

            <NumberField
              label="Αριθμός θαλάμων Dry Aged"
              value={
                profile.dryAgedChamberCount
              }
              onChange={(
                value
              ) =>
                update(
                  "dryAgedChamberCount",
                  value
                )
              }
            />

            <NumberField
              label="Αριθμός καταψύκτη/έκθεσης παγωτών"
              value={
                profile.iceCreamFreezerCount
              }
              onChange={(
                value
              ) =>
                update(
                  "iceCreamFreezerCount",
                  value
                )
              }
            />

            <NumberField
              label="Αριθμός προθηκών έκθεσης προϊόντων σοκολατοποιίας"
              value={
                profile.chocolateDisplayCount
              }
              onChange={(
                value
              ) =>
                update(
                  "chocolateDisplayCount",
                  value
                )
              }
            />
          </div>
        </div>

        {/* DAYS / HOLIDAYS */}
        <div>
          <h2 className="mb-2 font-semibold">
            Ημέρες & περίοδοι λειτουργίας
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm">
                Μέρες που είναι κλειστά
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  Object.keys(
                    WEEKDAY_LABELS
                  ) as Weekday[]
                ).map(
                  (
                    day
                  ) => {
                    const checked =
                      profile.closedWeekdays.includes(
                        day
                      );

                    return (
                      <button
                        key={
                          day
                        }
                        type="button"
                        onClick={() => {
                          const set =
                            new Set(
                              profile.closedWeekdays
                            );

                          if (
                            checked
                          ) {
                            set.delete(
                              day
                            );
                          } else {
                            set.add(
                              day
                            );
                          }

                          update(
                            "closedWeekdays",
                            Array.from(
                              set
                            ) as Weekday[]
                          );
                        }}
                        className={[
                          "rounded-full border px-3 py-1 text-xs",

                          checked
                            ? "border-transparent bg-[color:var(--brand,#25C3F4)] text-black"
                            : "border-gray-300",
                        ].join(
                          " "
                        )}
                      >
                        {
                          WEEKDAY_LABELS[
                            day
                          ]
                        }
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div>
              <div className="mb-1 text-sm">
                Αργίες που παραμένει κλειστή η επιχείρηση
              </div>

              <div className="grid gap-2">
                {(
                  Object.keys(
                    HOLIDAY_LABELS
                  ) as PublicHoliday[]
                ).map(
                  (
                    holiday
                  ) => {
                    const checked =
                      profile.closedHolidays.includes(
                        holiday
                      );

                    return (
                      <label
                        key={
                          holiday
                        }
                        className="flex items-center gap-2 rounded border p-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={
                            checked
                          }
                          onChange={(
                            event
                          ) => {
                            const set =
                              new Set(
                                profile.closedHolidays
                              );

                            if (
                              event
                                .target
                                .checked
                            ) {
                              set.add(
                                holiday
                              );
                            } else {
                              set.delete(
                                holiday
                              );
                            }

                            update(
                              "closedHolidays",
                              Array.from(
                                set
                              ) as PublicHoliday[]
                            );
                          }}
                        />

                        <span>
                          {
                            HOLIDAY_LABELS[
                              holiday
                            ]
                          }
                        </span>
                      </label>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 max-w-md">
            <div className="mb-1 text-sm">
              Διάστημα Αυγούστου (κλειστά)
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="rounded border p-2 text-sm"
                value={
                  profile
                    .augustRange
                    .from
                }
                onChange={(
                  event
                ) =>
                  update(
                    "augustRange",
                    {
                      ...profile.augustRange,

                      from:
                        event
                          .target
                          .value,
                    }
                  )
                }
              />

              <input
                type="date"
                className="rounded border p-2 text-sm"
                value={
                  profile
                    .augustRange
                    .to
                }
                onChange={(
                  event
                ) =>
                  update(
                    "augustRange",
                    {
                      ...profile.augustRange,

                      to:
                        event
                          .target
                          .value,
                    }
                  )
                }
              />
            </div>
          </div>
        </div>

        {/* PASSWORD RESET */}
        <div className="border-t border-[color:var(--border)] pt-2">
          <h2 className="mb-2 font-semibold">
            Reset κωδικού
          </h2>

          <div className="grid max-w-xl gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-sm">
                Νέος κωδικός
              </span>

              <input
                type="password"
                className="w-full rounded border p-2 text-sm"
                value={
                  pw.newPassword
                }
                onChange={(
                  event
                ) =>
                  setPw({
                    ...pw,

                    newPassword:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>

            <label className="block">
              <span className="text-sm">
                Επιβεβαίωση
              </span>

              <input
                type="password"
                className="w-full rounded border p-2 text-sm"
                value={
                  pw.confirm
                }
                onChange={(
                  event
                ) =>
                  setPw({
                    ...pw,

                    confirm:
                      event
                        .target
                        .value,
                  })
                }
              />
            </label>
          </div>

          {pwErr && (
            <p className="mt-2 text-sm text-red-600">
              {
                pwErr
              }
            </p>
          )}

          {pwMsg && (
            <p className="mt-2 text-sm text-green-700">
              {
                pwMsg
              }
            </p>
          )}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={
                resetPassword
              }
              disabled={
                pwSaving
              }
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{
                borderColor:
                  "var(--border)",

                backgroundColor:
                  "rgba(37,195,244,.12)",

                color:
                  "#061630",
              }}
            >
              {pwSaving
                ? "Ενημέρωση…"
                : "Αλλαγή κωδικού"}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600">
            {
              error
            }
          </p>
        )}

        {okMessage && (
          <p className="text-sm text-green-700">
            {
              okMessage
            }
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={
              save
            }
            disabled={
              saving
            }
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{
              backgroundColor:
                "var(--brand,#25C3F4)",

              color:
                "#061630",
            }}
          >
            {saving
              ? "Αποθήκευση…"
              : "Αποθήκευση αλλαγών"}
          </button>
        </div>
      </section>

      {/* ==================================================
          FILES FULL SCREEN MODAL
          ================================================== */}
      {filesOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() =>
              setFilesOpen(
                false
              )
            }
          />

          {/* Modal */}
          <div className="absolute inset-0 flex min-w-0 flex-col bg-white">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold">
                  Αρχεία χρήστη
                </div>

                <div className="truncate text-xs text-gray-500">
                  Upload & διαχείριση PDF φακέλων/αρχείων
                  {user?.email
                    ? ` · ${user.email}`
                    : ""}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void refreshFiles();

                    void loadFolders();
                  }}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
                >
                  Ανανέωση
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilesOpen(
                      false
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
                >
                  ✕ Κλείσιμο
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-4 px-2 py-4 sm:px-4 lg:px-6">
                {/* UPLOAD */}
                <section className="rounded-2xl border bg-white p-4">
                  <h3 className="font-semibold">
                    Upload αρχείου στον χρήστη
                  </h3>

                  <p className="mb-3 text-xs text-gray-500">
                    Το αρχείο θα ανατεθεί αυτόματα μόνο σε αυτόν τον χρήστη.
                    Για PDF μπορείτε να επιλέξετε έναν από τους προσωπικούς του
                    φακέλους.
                  </p>

                  <div className="grid gap-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
                    <input
                      className="w-full rounded border px-3 py-2 text-sm"
                      placeholder="Τίτλος"
                      value={
                        upTitle
                      }
                      onChange={(
                        event
                      ) =>
                        setUpTitle(
                          event
                            .target
                            .value
                        )
                      }
                    />

                    <input
                      id="admin-profile-user-file-input"
                      type="file"
                      className="w-full rounded border bg-white px-3 py-2 text-sm"
                      onChange={(
                        event
                      ) => {
                        const picked =
                          event
                            .currentTarget
                            .files?.[0] ??
                          null;

                        setUpFile(
                          picked
                        );

                        setUpPdfFolderId(
                          ""
                        );

                        if (
                          picked &&
                          !upTitle.trim()
                        ) {
                          setUpTitle(
                            cleanUploadedFilename(
                              picked.name
                            )
                          );
                        }
                      }}
                    />

                    {isPdfUpload(
                      upFile
                    ) ? (
                      <select
                        value={
                          upPdfFolderId
                        }
                        onChange={(
                          event
                        ) =>
                          setUpPdfFolderId(
                            event
                              .target
                              .value
                          )
                        }
                        className="w-full rounded border bg-white px-3 py-2 text-sm"
                      >
                        <option value="">
                          Χωρίς φάκελο
                        </option>

                        {folders.map(
                          (
                            folder
                          ) => (
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
                    ) : (
                      <div className="flex items-center rounded border bg-gray-50 px-3 py-2 text-sm text-gray-500">
                        Για PDF θα εμφανιστεί επιλογή φακέλου
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={
                        uploading
                      }
                      onClick={
                        uploadToUser
                      }
                      className="inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
                      style={{
                        backgroundColor:
                          "var(--brand,#25C3F4)",

                        color:
                          "#061630",
                      }}
                    >
                      {uploading
                        ? "Upload…"
                        : "Upload & Ανάθεση"}
                    </button>
                  </div>
                </section>

                {/* SEARCH */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <input
                    value={
                      query
                    }
                    onChange={(
                      event
                    ) =>
                      setQuery(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Αναζήτηση αρχείων…"
                    className="w-full max-w-[520px] rounded-xl border px-3 py-2 text-sm"
                  />

                  <div className="text-sm text-gray-500">
                    {loadingFiles
                      ? "Φόρτωση…"
                      : `${filteredFiles.length} αρχείο(α) · ${pdfs.length} PDF`}
                  </div>
                </div>

                {/* COLUMNS */}
                <div className="grid min-w-0 gap-4 lg:grid-cols-[1.6fr_1fr]">
                  {/* LEFT */}
                  <section className="min-w-0 rounded-2xl border bg-white p-4">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-semibold">
                        Αρχείο θερμοκρασιών & καθαρισμού - απολύμανσης (
                        {
                          others.length
                        }
                        )
                      </h3>
                    </div>

                    {others.length ===
                    0 ? (
                      <p className="mt-3 text-sm text-gray-500">
                        Δεν βρέθηκαν αρχεία.
                      </p>
                    ) : (
                      <div className="mt-3 w-full overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">
                          <thead className="bg-gray-50 text-gray-700">
                            <tr className="text-left">
                              <Th className="w-[54%]">
                                Τίτλος
                              </Th>

                              <Th className="w-[24%]">
                                Ανέβηκε
                              </Th>

                              <Th className="w-[12%]">
                                Μέγεθος
                              </Th>

                              <Th className="w-[10%] text-right">
                                Ενέργεια
                              </Th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-gray-100">
                            {others.map(
                              (
                                file
                              ) => {
                                const date =
                                  new Date(
                                    file.createdAt
                                  );

                                return (
                                  <tr
                                    key={
                                      file.id
                                    }
                                    className="align-top"
                                  >
                                    <Td className="break-words">
                                      {file.title ||
                                        "—"}
                                    </Td>

                                    <Td className="whitespace-nowrap">
                                      {date.toLocaleDateString()}{" "}
                                      {date.toLocaleTimeString()}
                                    </Td>

                                    <Td className="whitespace-nowrap">
                                      {formatSize(
                                        file.size
                                      )}
                                    </Td>

                                    <Td className="whitespace-nowrap text-right">
                                      <div className="inline-flex items-center gap-2">
                                        {file.url ? (
                                          <a
                                            href={
                                              file.url
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-block rounded-lg px-3 py-1 font-semibold text-black"
                                            style={{
                                              backgroundColor:
                                                "var(--brand, #25C3F4)",
                                            }}
                                          >
                                            Λήψη
                                          </a>
                                        ) : (
                                          <span className="text-gray-500">
                                            —
                                          </span>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() =>
                                            deleteFile(
                                              file.id
                                            )
                                          }
                                          disabled={
                                            deletingId ===
                                            file.id
                                          }
                                          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-sm hover:bg-black/5 disabled:opacity-60"
                                          title="Αφαίρεση από τον χρήστη"
                                        >
                                          <Trash2
                                            size={
                                              16
                                            }
                                          />

                                          {deletingId ===
                                          file.id
                                            ? "…"
                                            : "Διαγραφή"}
                                        </button>
                                      </div>
                                    </Td>
                                  </tr>
                                );
                              }
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {/* RIGHT PDFs */}
                  <section className="min-w-0 rounded-2xl border bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">
                        PDF (
                        {
                          pdfs.length
                        }
                        )
                      </h3>

                      <div className="flex items-center gap-2">
                        <select
                          className="max-w-[220px] rounded-lg border px-2 py-1 text-sm"
                          value={
                            folderFilter
                          }
                          onChange={(
                            event
                          ) =>
                            setFolderFilter(
                              event
                                .target
                                .value
                            )
                          }
                        >
                          <option value="ALL">
                            Όλα
                          </option>

                          <option value="NONE">
                            Χωρίς φάκελο
                          </option>

                          {folders.map(
                            (
                              folder
                            ) => (
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

                        <button
                          type="button"
                          onClick={
                            createFolder
                          }
                          disabled={
                            creatingFolder
                          }
                          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-sm disabled:opacity-60"
                        >
                          <Plus
                            size={
                              16
                            }
                          />

                          Φάκελος
                        </button>
                      </div>
                    </div>

                    {/* PERSONAL FOLDER LIST */}
                    <div className="mt-3 max-h-[240px] overflow-auto rounded-xl border bg-gray-50 p-2">
                      {loadingFolders ? (
                        <div className="px-2 py-2 text-sm text-gray-500">
                          Φόρτωση φακέλων…
                        </div>
                      ) : folders.length ===
                        0 ? (
                        <div className="px-2 py-2 text-sm text-gray-500">
                          Δεν υπάρχουν φάκελοι.
                        </div>
                      ) : (
                        <div className="grid gap-1">
                          <FolderRow
                            active={
                              folderFilter ===
                              "ALL"
                            }
                            name="Όλα"
                            onClick={() =>
                              setFolderFilter(
                                "ALL"
                              )
                            }
                          />

                          <FolderRow
                            active={
                              folderFilter ===
                              "NONE"
                            }
                            name="Χωρίς φάκελο"
                            onClick={() =>
                              setFolderFilter(
                                "NONE"
                              )
                            }
                          />

                          <div className="my-1 h-px bg-gray-200" />

                          {folders.map(
                            (
                              folder
                            ) => (
                              <div
                                key={
                                  folder.id
                                }
                                className={[
                                  "group flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2",

                                  folderFilter ===
                                  folder.id
                                    ? "border bg-white"
                                    : "hover:bg-white/70",
                                ].join(
                                  " "
                                )}
                                onClick={() =>
                                  setFolderFilter(
                                    folder.id
                                  )
                                }
                                title={
                                  folder.name
                                }
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <Folder
                                    size={
                                      16
                                    }
                                    className="shrink-0"
                                  />

                                  <div className="truncate text-sm">
                                    {
                                      folder.name
                                    }
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                  <button
                                    type="button"
                                    className="rounded p-1 hover:bg-gray-100"
                                    onClick={(
                                      event
                                    ) => {
                                      event.stopPropagation();

                                      void renameFolder(
                                        folder.id,
                                        folder.name
                                      );
                                    }}
                                    aria-label="Μετονομασία"
                                  >
                                    <Pencil
                                      size={
                                        14
                                      }
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    className="rounded p-1 hover:bg-gray-100"
                                    onClick={(
                                      event
                                    ) => {
                                      event.stopPropagation();

                                      void deleteFolder(
                                        folder.id
                                      );
                                    }}
                                    aria-label="Διαγραφή"
                                  >
                                    <Trash2
                                      size={
                                        14
                                      }
                                    />
                                  </button>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {/* PDFs */}
                    {pdfsFilteredByFolder.length ===
                    0 ? (
                      <p className="mt-4 text-sm text-gray-500">
                        Δεν βρέθηκαν αρχεία.
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-2">
                        {pdfsFilteredByFolder.map(
                          (
                            file
                          ) => {
                            const date =
                              new Date(
                                file.createdAt
                              );

                            return (
                              <div
                                key={
                                  file.id
                                }
                                className="rounded-xl border p-3"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-start gap-2">
                                    <FileText
                                      size={
                                        16
                                      }
                                      className="mt-0.5 shrink-0"
                                    />

                                    <div className="min-w-0 break-words font-medium">
                                      {file.title ||
                                        file.originalName ||
                                        "PDF"}
                                    </div>
                                  </div>

                                  <div className="mt-1 pl-6 text-xs text-gray-600">
                                    {date.toLocaleDateString()}{" "}
                                    {date.toLocaleTimeString()}{" "}
                                    ·{" "}
                                    {formatSize(
                                      file.size
                                    )}
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-col gap-2">
                                  {/* USER-SPECIFIC FOLDER */}
                                  <select
                                    className="w-full rounded-lg border px-2 py-2 text-sm"
                                    value={
                                      file.pdfFolderId ??
                                      ""
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      void movePdf(
                                        file.id,

                                        event
                                          .target
                                          .value
                                          ? event
                                              .target
                                              .value
                                          : null
                                      )
                                    }
                                  >
                                    <option value="">
                                      Χωρίς φάκελο
                                    </option>

                                    {folders.map(
                                      (
                                        folder
                                      ) => (
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

                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                                    {file.url ? (
                                      <a
                                        href={
                                          file.url
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-black"
                                        style={{
                                          backgroundColor:
                                            "var(--brand, #25C3F4)",
                                        }}
                                      >
                                        Λήψη
                                      </a>
                                    ) : (
                                      <span className="text-gray-500">
                                        —
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteFile(
                                          file.id
                                        )
                                      }
                                      disabled={
                                        deletingId ===
                                        file.id
                                      }
                                      className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-60"
                                      title="Αφαίρεση από τον χρήστη"
                                    >
                                      <Trash2
                                        size={
                                          16
                                        }
                                      />

                                      {deletingId ===
                                      file.id
                                        ? "…"
                                        : "Διαγραφή"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </section>
                </div>

                <div className="pt-2 text-xs text-gray-500">
                  Tip: Πάτησε{" "}
                  <b>
                    Esc
                  </b>{" "}
                  για κλείσιμο.
                </div>
              </div>
            </div>
          </div>

          <EscClose
            onClose={() =>
              setFilesOpen(
                false
              )
            }
          />
        </div>
      )}
    </div>
  );
}

function EscClose({
  onClose,
}: {
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(
      event: KeyboardEvent
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      onKey
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKey
      );
  }, [onClose]);

  return null;
}

function FolderRow({
  active,
  name,
  onClick,
}: {
  active: boolean;
  name: string;
  onClick: () => void;
}) {
  return (
    <div
      className={[
        "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2",

        active
          ? "border bg-white"
          : "hover:bg-white/70",
      ].join(
        " "
      )}
      onClick={
        onClick
      }
    >
      <Folder
        size={
          16
        }
        className="shrink-0"
      />

      <span className="text-sm">
        {
          name
        }
      </span>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children:
    React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-3 font-semibold ${className}`}
    >
      {
        children
      }
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children:
    React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-3 ${className}`}
    >
      {
        children
      }
    </td>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    value: number
  ) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm">
        {
          label
        }
      </span>

      <input
        type="number"
        min={
          0
        }
        className="w-full rounded border p-2 text-sm"
        value={
          value
        }
        onChange={(
          event
        ) => {
          const raw =
            event
              .target
              .value;

          if (
            raw ===
            ""
          ) {
            onChange(
              0
            );

            return;
          }

          const numberValue =
            Number(
              raw
            );

          onChange(
            Number.isFinite(
              numberValue
            )
              ? numberValue
              : 0
          );
        }}
      />
    </label>
  );
}