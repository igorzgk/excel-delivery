// src/app/(admin)/admin/users/[id]/profile/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Folder, FileText, Plus, Pencil, Trash2 } from "lucide-react";

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
  | "PASTRY_SHOP_NO_COFFEE" // keep if you have it in DB
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
  | "BOXING_DAY";

type ProfilePayload = {
  businessName: string;
  addressStreet: string; // ✅ NEW
  businessTypes: BusinessType[];

  fridgeCount: number;
  freezerCount: number;
  hotCabinetCount: number;
  dryAgedChamberCount: number;
  iceCreamFreezerCount: number;

  supervisorInitials: string;

  closedWeekdays: Weekday[];
  closedHolidays: PublicHoliday[];

  augustRange: { from: string; to: string };
};

type AdminUserMeta = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  role: string;
};

const BUSINESS_TYPES_LABELS: Record<BusinessType, string> = {
  RESTAURANT_GRILL: "Εστιατόριο - Ψητοπωλείο",
  RESTAURANT_GRILL_HYGIENE_WITH_COFFEE: "Εστιατόριο - Ψητοπωλείο με παροχή καφέ",
  BAR_WINE: "Bar – Wine Bar",
  REFRESHMENT_CAFE: "Αναψυκτήριο – καφετέρια",
  SCHOOL_KIOSK: "Σχολικό κυλικείο",
  PASTRY_SHOP_WITH_COFFEE: "Πρατήριο ζαχ/κής - γάλακτος με παροχή καφέ",
  PASTRY_SHOP_NO_COFFEE: "Πρατήριο ζαχ/κής χωρίς παροχή καφέ",
  BREAD_SHOP_WITH_COFFEE: "Πρατήριο άρτου με παροχή καφέ",
  BUTCHER: "Κρεοπωλείο",
  BUTCHER_HOT_CORNER: "Κρεοπωλείο με ζεστή γωνιά",
  FISHMONGER: "Ιχθυοπωλείο",
  FISHMONGER_HOT_CORNER: "Ιχθυοπωλείο με ζεστή γωνιά",
  DELI_CHEESE_CURED_MEAT: "Διάθεση προϊόντων αλλαντοποιίας / τυροκομίας",
  BAKERY_WITH_COFFEE: "Αρτοποιείο με παροχή καφέ",
  BAKERY_NO_COFFEE: "Αρτοποιείο χωρίς παροχή καφέ",
  BAKERY_PASTRY_WITH_COFFEE: "Αρτοποιείο – Ζαχαροπλαστείο με παροχή καφέ",
  PASTRY_WITH_COFFEE: "Ζαχαροπλαστείο με παροχή καφέ",
  PASTRY_NO_COFFEE: "Ζαχαροπλαστείο χωρίς παροχή καφέ",
  GROCERY_FRUIT: "Παντοπωλείο / οπωροπωλείο",
  WINE_NUTS_SHOP: "Κάβα / κατάστημα ξηρών καρπών",
  FROZEN_PRODUCTS_SHOP: "Πρατήριο κατεψυγμένων προϊόντων",
  PACKAGED_FRESH_FROZEN_DRY: "Συσκευασμένα προϊόντα νωπά/κατεψυγμένα/ξηρού φορτίου",
  ICE_CREAM_SHOP: "Παγωτοπωλείο",
  PUFF_PASTRY_PRODUCTION: "Παρασκευή – πώληση σφολιατοειδών προϊόντων",
};

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Δευτέρα",
  TUESDAY: "Τρίτη",
  WEDNESDAY: "Τετάρτη",
  THURSDAY: "Πέμπτη",
  FRIDAY: "Παρασκευή",
  SATURDAY: "Σάββατο",
  SUNDAY: "Κυριακή",
};

const HOLIDAY_LABELS: Record<PublicHoliday, string> = {
  NEW_YEAR: "01/01 (Πρωτοχρονιά)",
  THEOPHANY_JAN_6: "06/01 (Θεοφάνεια)",
  CLEAN_MONDAY: "Καθαρά Δευτέρα",
  MARCH_25: "25/03 (Εθνική εορτή)",
  EASTER_SUNDAY: "Κυριακή του Πάσχα",
  EASTER_MONDAY: "Δευτέρα του Πάσχα",
  AUG_15: "15/08 (Κοίμηση Θεοτόκου)",
  OCT_28: "28/10 (Εθνική εορτή)",
  CHRISTMAS: "25/12 (Χριστούγεννα)",
  BOXING_DAY: "26/12 (Επίσημη αργία)",
};

// ---------- Files / PDF types ----------
type FileItem = {
  id: string;
  title: string;
  originalName?: string | null;
  createdAt: string | Date;
  size?: number | null;
  url?: string | null;
  mime?: string | null;
  pdfFolderId?: string | null;
  uploadedBy?: { id: string; email: string; name?: string | null } | null;
  assignments?: { user: { id: string; email: string; name?: string | null } }[];
};

type FolderItem = { id: string; name: string };

function isPdfFile(f: FileItem) {
  const mime = (f.mime || "").toLowerCase();
  const name = (f.originalName || "").toLowerCase();
  const title = (f.title || "").toLowerCase();
  if (mime.includes("pdf")) return true;
  if (name.endsWith(".pdf") || name.includes(".pdf")) return true;
  if (title.endsWith(".pdf") || title.includes(".pdf")) return true;
  return false;
}

function formatSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function AdminUserProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;

  const [user, setUser] = useState<AdminUserMeta | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  // password reset state
  const [pw, setPw] = useState({ newPassword: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  // modal state
  const [filesOpen, setFilesOpen] = useState(false);

  // modal data
  const [query, setQuery] = useState("");
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("ALL"); // ALL | NONE | folderId
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  // upload-to-user state
  const [upTitle, setUpTitle] = useState("");
  const [upFile, setUpFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}/profile`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Αποτυχία φόρτωσης προφίλ");

        const u = json.user as AdminUserMeta;
        const p = json.profile as any | null;

        setUser(u);

        if (!p) {
          setProfile({
            businessName: "",
            addressStreet: "", // ✅ NEW
            businessTypes: [],
            fridgeCount: 0,
            freezerCount: 0,
            hotCabinetCount: 0,
            dryAgedChamberCount: 0,
            iceCreamFreezerCount: 0,
            supervisorInitials: "",
            closedWeekdays: [],
            closedHolidays: [],
            augustRange: { from: "", to: "" },
          });
        } else {
          setProfile({
            businessName: p.businessName ?? "",
            addressStreet: p.addressStreet ?? "", // ✅ NEW
            businessTypes: (p.businessTypes ?? []) as BusinessType[],
            fridgeCount: p.fridgeCount ?? 0,
            freezerCount: p.freezerCount ?? 0,
            hotCabinetCount: p.hotCabinetCount ?? 0,
            dryAgedChamberCount: p.dryAgedChamberCount ?? 0,
            iceCreamFreezerCount: p.iceCreamFreezerCount ?? 0,
            supervisorInitials: p.supervisorInitials ?? "",
            closedWeekdays: (p.closedWeekdays ?? []) as Weekday[],
            closedHolidays: (p.closedHolidays ?? []) as PublicHoliday[],
            augustRange: { from: p.augustRange?.from || "", to: p.augustRange?.to || "" },
          });
        }
      } catch (err: any) {
        setError(err.message || "Αποτυχία φόρτωσης προφίλ");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Lock body scroll when modal open (prevents weird horizontal/vertical scroll)
  useEffect(() => {
    if (!filesOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [filesOpen]);

  function update<K extends keyof ProfilePayload>(key: K, value: ProfilePayload[K]) {
    if (!profile) return;
    setProfile({ ...profile, [key]: value });
  }

  async function save() {
    if (!profile || !userId) return;
    setSaving(true);
    setError(null);
    setOkMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Αποτυχία αποθήκευσης");
      setOkMessage("Το προφίλ αποθηκεύτηκε.");
    } catch (err: any) {
      setError(err.message || "Αποτυχία αποθήκευσης");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!userId) return;
    setPwMsg(null);
    setPwErr(null);

    if (pw.newPassword.length < 6) {
      setPwErr("Ο νέος κωδικός πρέπει να είναι τουλάχιστον 6 χαρακτήρες.");
      return;
    }
    if (pw.newPassword !== pw.confirm) {
      setPwErr("Η επιβεβαίωση κωδικού δεν ταιριάζει.");
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pw.newPassword }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Αποτυχία αλλαγής κωδικού");
      setPwMsg("Ο κωδικός ενημερώθηκε.");
      setPw({ newPassword: "", confirm: "" });
    } catch (e: any) {
      setPwErr(e.message || "Αποτυχία αλλαγής κωδικού");
    } finally {
      setPwSaving(false);
    }
  }

  // ---------------- Modal: load files + folders ----------------
  async function refreshFiles() {
    if (!userId) return;
    setLoadingFiles(true);
    try {
      const res = await fetch("/api/files?scope=all", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Αποτυχία φόρτωσης αρχείων");

      const rows = (j.files || []) as FileItem[];

      // only this user's files:
      const filtered = rows.filter((f) => {
        const assigned = (f.assignments || []).some((a) => a.user.id === userId);
        const uploadedBy = f.uploadedBy?.id === userId;
        return assigned || uploadedBy;
      });

      setAllFiles(filtered);
    } catch {
      // silent
    } finally {
      setLoadingFiles(false);
    }
  }

  async function loadFolders() {
    if (!userId) return;
    setLoadingFolders(true);
    try {
      const res = await fetch(`/api/pdf-folders?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setFolders(j.folders || []);
    } finally {
      setLoadingFolders(false);
    }
  }

  useEffect(() => {
    if (!filesOpen) return;
    refreshFiles();
    loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesOpen, userId]);

  // Upload file to user (create + assign)
  async function uploadToUser() {
    if (!userId) return;
    if (!upTitle.trim() || !upFile) {
      alert("Συμπληρώστε τίτλο και επιλέξτε αρχείο.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", upTitle.trim());
      fd.append("file", upFile);
      fd.append("assignTo", userId);

      const res = await fetch("/api/files", { method: "POST", body: fd });
      const txt = await res.text().catch(() => "");
      if (!res.ok) throw new Error(txt || "Αποτυχία upload");

      setUpTitle("");
      setUpFile(null);
      await refreshFiles();
    } catch (e: any) {
      alert(e?.message || "Αποτυχία upload");
    } finally {
      setUploading(false);
    }
  }

  async function createFolder() {
    if (!userId) return;
    const name = prompt("Όνομα φακέλου (PDF):")?.trim();
    if (!name) return;

    setCreatingFolder(true);
    try {
      const res = await fetch("/api/pdf-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, userId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error === "folder_exists" ? "Ο φάκελος υπάρχει ήδη." : "Αποτυχία δημιουργίας φακέλου.");
        return;
      }
      await loadFolders();
      setFolderFilter(j.folder?.id || "ALL");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function renameFolder(id: string, current: string) {
    if (!userId) return;
    const name = prompt("Νέο όνομα φακέλου:", current)?.trim();
    if (!name || name === current) return;

    const res = await fetch(`/api/pdf-folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, userId }),
    });
    if (!res.ok) {
      alert("Αποτυχία μετονομασίας.");
      return;
    }
    await loadFolders();
  }

  async function deleteFolder(id: string) {
    if (!userId) return;
    if (!confirm("Διαγραφή φακέλου; (τα PDF δεν θα διαγραφούν, απλά θα βγουν από τον φάκελο)")) return;

    const res = await fetch(`/api/pdf-folders/${id}?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Αποτυχία διαγραφής φακέλου.");
      return;
    }

    setAllFiles((prev) => prev.map((f) => (f.pdfFolderId === id ? { ...f, pdfFolderId: null } : f)));
    setFolderFilter("ALL");
    await loadFolders();
  }

  async function movePdf(fileId: string, pdfFolderId: string | null) {
    try {
      const r1 = await fetch(`/api/files/${fileId}/pdf-folder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfFolderId }),
      });

      if (r1.ok) {
        setAllFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, pdfFolderId } : f)));
        return;
      }

      const err1 = await r1.text().catch(() => "");

      const r2 = await fetch(`/api/pdf-folders/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, pdfFolderId, userId }),
      });

      if (!r2.ok) {
        const err2 = await r2.text().catch(() => "");
        console.error("movePdf failed:", { r1Status: r1.status, err1, r2Status: r2.status, err2 });
        alert("Αποτυχία μετακίνησης PDF.");
        return;
      }

      setAllFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, pdfFolderId } : f)));
    } catch (e) {
      console.error(e);
      alert("Αποτυχία μετακίνησης PDF.");
    }
  }

  // filtered lists
  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allFiles;
    return allFiles.filter((f) => {
      const t = (f.title || "").toLowerCase();
      const o = (f.originalName || "").toLowerCase();
      return t.includes(q) || o.includes(q);
    });
  }, [allFiles, query]);

  const { pdfs, others } = useMemo(() => {
    const p = filteredFiles.filter(isPdfFile);
    const o = filteredFiles.filter((x) => !isPdfFile(x));
    return { pdfs: p, others: o };
  }, [filteredFiles]);

  const pdfsFilteredByFolder = useMemo(() => {
    if (folderFilter === "ALL") return pdfs;
    if (folderFilter === "NONE") return pdfs.filter((p) => !p.pdfFolderId);
    return pdfs.filter((p) => p.pdfFolderId === folderFilter);
  }, [pdfs, folderFilter]);

  if (loading || !profile) {
    return (
      <div className="p-6">
        <p className="text-sm text-[color:var(--muted)]">Φόρτωση…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Προφίλ πελάτη</h1>
          {user && <p className="text-sm text-gray-500 truncate">{user.name || "—"} · {user.email}</p>}
        </div>

        <button
          type="button"
          onClick={() => setFilesOpen(true)}
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
        >
          Αρχεία χρήστη
        </button>
      </header>

      {/* MAIN CARD */}
      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] shadow-sm p-4 space-y-5">
        {/* Βασικά στοιχεία */}
        <div>
          <h2 className="font-semibold mb-2">Βασικά στοιχεία</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-sm">Επωνυμία επιχείρησης</span>
              <input
                className="w-full border rounded p-2 text-sm"
                value={profile.businessName}
                onChange={(e) => update("businessName", e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm">Οδός</span>
              <input
                className="w-full border rounded p-2 text-sm"
                placeholder="π.χ. Πατησίων 12"
                value={profile.addressStreet}
                onChange={(e) => update("addressStreet", e.target.value)}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm">Αρχικά υπευθύνου καταγραφής</span>
              <input
                className="w-full border rounded p-2 text-sm"
                value={profile.supervisorInitials}
                onChange={(e) => update("supervisorInitials", e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Είδος επιχείρησης */}
        <div>
          <h2 className="font-semibold mb-2">Είδος επιχείρησης</h2>
          <div className="grid md:grid-cols-2 gap-2">
            {(Object.keys(BUSINESS_TYPES_LABELS) as BusinessType[]).map((key) => {
              const checked = profile.businessTypes.includes(key);
              return (
                <label key={key} className="flex items-center gap-2 border rounded p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const set = new Set(profile.businessTypes);
                      e.target.checked ? set.add(key) : set.delete(key);
                      update("businessTypes", Array.from(set) as BusinessType[]);
                    }}
                  />
                  <span>{BUSINESS_TYPES_LABELS[key]}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Εξοπλισμός */}
        <div>
          <h2 className="font-semibold mb-2">Εξοπλισμός αποθήκευσης/διατήρησης τροφίμων</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            <NumberField label="Αριθμός ψυγείων" value={profile.fridgeCount} onChange={(v) => update("fridgeCount", v)} />
            <NumberField label="Αριθμός καταψύξεων" value={profile.freezerCount} onChange={(v) => update("freezerCount", v)} />
            <NumberField label="Αριθμός θερμοθαλάμων / Bain Marie" value={profile.hotCabinetCount} onChange={(v) => update("hotCabinetCount", v)} />
            <NumberField label="Αριθμός θαλάμων Dry Aged" value={profile.dryAgedChamberCount} onChange={(v) => update("dryAgedChamberCount", v)} />
            <NumberField
              label="Αριθμός καταψύκτη/έκθεσης παγωτών"
              value={profile.iceCreamFreezerCount}
              onChange={(v) => update("iceCreamFreezerCount", v)}
            />
          </div>
        </div>

        {/* Ημέρες / Αργίες / Αυγουστος */}
        <div>
          <h2 className="font-semibold mb-2">Ημέρες & περίοδοι λειτουργίας</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm mb-1">Μέρες που είναι κλειστά</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(WEEKDAY_LABELS) as Weekday[]).map((day) => {
                  const checked = profile.closedWeekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const set = new Set(profile.closedWeekdays);
                        checked ? set.delete(day) : set.add(day);
                        update("closedWeekdays", Array.from(set) as Weekday[]);
                      }}
                      className={[
                        "px-3 py-1 rounded-full border text-xs",
                        checked ? "bg-[color:var(--brand,#25C3F4)] text-black border-transparent" : "border-gray-300",
                      ].join(" ")}
                    >
                      {WEEKDAY_LABELS[day]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-sm mb-1">Αργίες που παραμένει κλειστή η επιχείρηση</div>
              <div className="grid gap-2">
                {(Object.keys(HOLIDAY_LABELS) as PublicHoliday[]).map((h) => {
                  const checked = profile.closedHolidays.includes(h);
                  return (
                    <label key={h} className="flex items-center gap-2 border rounded p-2 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const set = new Set(profile.closedHolidays);
                          e.target.checked ? set.add(h) : set.delete(h);
                          update("closedHolidays", Array.from(set) as PublicHoliday[]);
                        }}
                      />
                      <span>{HOLIDAY_LABELS[h]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 max-w-md">
            <div className="text-sm mb-1">Διάστημα Αυγούστου (κλειστά)</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="border rounded p-2 text-sm"
                value={profile.augustRange.from}
                onChange={(e) => update("augustRange", { ...profile.augustRange, from: e.target.value })}
              />
              <input
                type="date"
                className="border rounded p-2 text-sm"
                value={profile.augustRange.to}
                onChange={(e) => update("augustRange", { ...profile.augustRange, to: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* ✅ Password reset for admin */}
        <div className="pt-2 border-t border-[color:var(--border)]">
          <h2 className="font-semibold mb-2">Reset κωδικού</h2>
          <div className="grid md:grid-cols-2 gap-3 max-w-xl">
            <label className="block">
              <span className="text-sm">Νέος κωδικός</span>
              <input
                type="password"
                className="w-full border rounded p-2 text-sm"
                value={pw.newPassword}
                onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm">Επιβεβαίωση</span>
              <input
                type="password"
                className="w-full border rounded p-2 text-sm"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            </label>
          </div>

          {pwErr && <p className="text-sm text-red-600 mt-2">{pwErr}</p>}
          {pwMsg && <p className="text-sm text-green-700 mt-2">{pwMsg}</p>}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={resetPassword}
              disabled={pwSaving}
              className="rounded-xl px-4 py-2 text-sm font-semibold border"
              style={{ borderColor: "var(--border)", backgroundColor: "rgba(37,195,244,.12)", color: "#061630" }}
            >
              {pwSaving ? "Ενημέρωση…" : "Αλλαγή κωδικού"}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {okMessage && <p className="text-sm text-green-700">{okMessage}</p>}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
          >
            {saving ? "Αποθήκευση…" : "Αποθήκευση αλλαγών"}
          </button>
        </div>
      </section>

      {/* ===================== FULL SCREEN MODAL (WIDER CONTENT) ===================== */}
      {filesOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* overlay */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setFilesOpen(false)} />

          {/* modal */}
          <div className="absolute inset-0 bg-white flex flex-col min-w-0">
            {/* header */}
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold">Αρχεία χρήστη</div>
                <div className="text-xs text-gray-500 truncate">Upload & διαχείριση PDF φακέλων/αρχείων</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    refreshFiles();
                    loadFolders();
                  }}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
                >
                  Ανανέωση
                </button>
                <button
                  type="button"
                  onClick={() => setFilesOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
                >
                  ✕ Κλείσιμο
                </button>
              </div>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {/* ✅ WIDER MAX WIDTH + SMALLER SIDE PADDING */}
              <div className="mx-auto w-full max-w-[1400px] px-2 sm:px-4 lg:px-6 py-4 space-y-4 min-w-0">
                {/* upload */}
                <section className="rounded-2xl border bg-white p-4">
                  <h3 className="font-semibold">Upload αρχείου στον χρήστη</h3>
                  <p className="text-xs text-gray-500 mb-3">Το αρχείο θα ανατεθεί αυτόματα στον χρήστη.</p>

                  <div className="grid gap-2">
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="Τίτλος"
                      value={upTitle}
                      onChange={(e) => setUpTitle(e.target.value)}
                    />
                    <input
                      type="file"
                      className="w-full border rounded px-3 py-2 text-sm bg-white"
                      onChange={(e) => setUpFile(e.currentTarget.files?.[0] ?? null)}
                    />

                    <button
                      type="button"
                      disabled={uploading}
                      onClick={uploadToUser}
                      className="w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
                      style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
                    >
                      {uploading ? "Upload…" : "Upload & Ανάθεση στον χρήστη"}
                    </button>
                  </div>
                </section>

                {/* search + counts */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Αναζήτηση αρχείων…"
                    className="w-full max-w-[520px] rounded-xl border px-3 py-2 text-sm"
                  />
                  <div className="text-sm text-gray-500">
                    {loadingFiles ? "Φόρτωση…" : `${filteredFiles.length} αρχείο(α) · ${pdfs.length} PDF`}
                  </div>
                </div>

                {/* ✅ WIDER COLUMNS */}
                <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] min-w-0">
                  {/* LEFT: other files */}
                  <section className="min-w-0 rounded-2xl border bg-white p-4">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-semibold">Αρχεία (όχι PDF) ({others.length})</h3>
                    </div>

                    {others.length === 0 ? (
                      <p className="mt-3 text-sm text-gray-500">Δεν βρέθηκαν αρχεία.</p>
                    ) : (
                      <div className="mt-3 w-full overflow-x-auto">
                        <table className="min-w-[760px] w-full text-sm">
                          <thead className="bg-gray-50 text-gray-700">
                            <tr className="text-left">
                              <Th className="w-[54%]">Τίτλος</Th>
                              <Th className="w-[24%]">Ανέβηκε</Th>
                              <Th className="w-[12%]">Μέγεθος</Th>
                              <Th className="w-[10%] text-right">Ενέργεια</Th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {others.map((f) => {
                              const dt = new Date(f.createdAt);
                              return (
                                <tr key={f.id} className="align-top">
                                  <Td className="break-words">{f.title || "—"}</Td>
                                  <Td className="whitespace-nowrap">
                                    {dt.toLocaleDateString()} {dt.toLocaleTimeString()}
                                  </Td>
                                  <Td className="whitespace-nowrap">{formatSize(f.size)}</Td>
                                  <Td className="text-right whitespace-nowrap">
                                    {f.url ? (
                                      <a
                                        href={f.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-block rounded-lg px-3 py-1 font-semibold text-black"
                                        style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                                      >
                                        Λήψη
                                      </a>
                                    ) : (
                                      <span className="text-gray-500">—</span>
                                    )}
                                  </Td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {/* RIGHT: PDFs */}
                  <section className="min-w-0 rounded-2xl border bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">PDF ({pdfs.length})</h3>

                      <div className="flex items-center gap-2">
                        <select
                          className="rounded-lg border px-2 py-1 text-sm max-w-[200px]"
                          value={folderFilter}
                          onChange={(e) => setFolderFilter(e.target.value)}
                        >
                          <option value="ALL">Όλα</option>
                          <option value="NONE">Χωρίς φάκελο</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={createFolder}
                          disabled={creatingFolder}
                          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-sm disabled:opacity-60"
                        >
                          <Plus size={16} /> Φάκελος
                        </button>
                      </div>
                    </div>

                    {/* folders list */}
                    <div className="mt-3 rounded-xl border bg-gray-50 p-2 max-h-[240px] overflow-auto">
                      {loadingFolders ? (
                        <div className="text-sm text-gray-500 px-2 py-2">Φόρτωση φακέλων…</div>
                      ) : folders.length === 0 ? (
                        <div className="text-sm text-gray-500 px-2 py-2">Δεν υπάρχουν φάκελοι.</div>
                      ) : (
                        <div className="grid gap-1">
                          <FolderRow active={folderFilter === "ALL"} name="Όλα" onClick={() => setFolderFilter("ALL")} />
                          <FolderRow active={folderFilter === "NONE"} name="Χωρίς φάκελο" onClick={() => setFolderFilter("NONE")} />
                          <div className="my-1 h-px bg-gray-200" />

                          {folders.map((f) => (
                            <div
                              key={f.id}
                              className={[
                                "group flex items-center justify-between gap-2 rounded-lg px-2 py-2 cursor-pointer",
                                folderFilter === f.id ? "bg-white border" : "hover:bg-white/70",
                              ].join(" ")}
                              onClick={() => setFolderFilter(f.id)}
                              title={f.name}
                            >
                              <div className="min-w-0 flex items-center gap-2">
                                <Folder size={16} className="shrink-0" />
                                <div className="truncate text-sm">{f.name}</div>
                              </div>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-gray-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    renameFolder(f.id, f.name);
                                  }}
                                  aria-label="Μετονομασία"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-gray-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteFolder(f.id);
                                  }}
                                  aria-label="Διαγραφή"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* pdf list */}
                    {pdfsFilteredByFolder.length === 0 ? (
                      <p className="mt-4 text-sm text-gray-500">Δεν βρέθηκαν αρχεία.</p>
                    ) : (
                      <div className="mt-4 grid gap-2">
                        {pdfsFilteredByFolder.map((f) => {
                          const dt = new Date(f.createdAt);
                          return (
                            <div key={f.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <FileText size={16} className="shrink-0" />
                                  <div className="font-medium break-words">{f.title || f.originalName || "PDF"}</div>
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {dt.toLocaleDateString()} {dt.toLocaleTimeString()} · {formatSize(f.size)}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <select
                                  className="rounded-lg border px-2 py-1 text-xs max-w-[200px]"
                                  value={f.pdfFolderId ?? ""}
                                  onChange={(e) => movePdf(f.id, e.target.value ? e.target.value : null)}
                                >
                                  <option value="">(Χωρίς)</option>
                                  {folders.map((fo) => (
                                    <option key={fo.id} value={fo.id}>
                                      {fo.name}
                                    </option>
                                  ))}
                                </select>

                                {f.url ? (
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-block rounded-lg px-3 py-2 text-sm font-semibold text-black"
                                    style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                                  >
                                    Λήψη
                                  </a>
                                ) : (
                                  <span className="text-gray-500">—</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>

                <div className="text-xs text-gray-500 pt-2">
                  Tip: Πάτησε <b>Esc</b> για κλείσιμο.
                </div>
              </div>
            </div>
          </div>

          {/* ESC close */}
          <EscClose onClose={() => setFilesOpen(false)} />
        </div>
      )}
    </div>
  );
}

function EscClose({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return null;
}

function FolderRow({ active, name, onClick }: { active: boolean; name: string; onClick: () => void }) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer",
        active ? "bg-white border" : "hover:bg-white/70",
      ].join(" ")}
      onClick={onClick}
    >
      <Folder size={16} className="shrink-0" />
      <span className="text-sm">{name}</span>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-3 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        min={0}
        className="w-full border rounded p-2 text-sm"
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(0);
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </label>
  );
}