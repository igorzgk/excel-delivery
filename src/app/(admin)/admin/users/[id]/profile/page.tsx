"use client";

import { useEffect, useMemo, useState } from "react";
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

type FileItem = {
  id: string;
  title: string;
  originalName?: string | null;
  createdAt: string | Date;
  size?: number | null;
  url?: string | null;
  mime?: string | null;
  uploadedBy?: { id: string; email: string; name?: string | null } | null;
  assignments?: { user: { id: string; email: string; name?: string | null } }[];
  pdfFolderId?: string | null;
};

type FolderItem = { id: string; name: string };

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
  BAKERY_NO_COFFEE: "Αρτοποιείο με παροχή καφέ",
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

function isPdfFile(f: FileItem) {
  const mime = (f.mime || "").toLowerCase();
  const name = (f.originalName || "").toLowerCase();
  const title = (f.title || "").toLowerCase();
  if (mime.includes("pdf")) return true;
  if (name.includes(".pdf")) return true;
  if (title.includes(".pdf")) return true;
  return false;
}

function fileBelongsToUser(file: FileItem, userId: string) {
  const uploadedBy = file.uploadedBy?.id;
  const assigned = (file.assignments || []).some((a) => a.user.id === userId);
  return uploadedBy === userId || assigned;
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

  const [pw, setPw] = useState({ newPassword: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  // files area
  const [filesLoading, setFilesLoading] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [query, setQuery] = useState("");

  const [upTitle, setUpTitle] = useState("");
  const [upFile, setUpFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("ALL");
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

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
            businessTypes: (p.businessTypes ?? []) as BusinessType[],
            fridgeCount: p.fridgeCount ?? 0,
            freezerCount: p.freezerCount ?? 0,
            hotCabinetCount: p.hotCabinetCount ?? 0,
            dryAgedChamberCount: p.dryAgedChamberCount ?? 0,
            iceCreamFreezerCount: p.iceCreamFreezerCount ?? 0,
            supervisorInitials: p.supervisorInitials ?? "",
            closedWeekdays: (p.closedWeekdays ?? []) as Weekday[],
            closedHolidays: (p.closedHolidays ?? []) as PublicHoliday[],
            augustRange: {
              from: p.augustRange?.from || "",
              to: p.augustRange?.to || "",
            },
          });
        }
      } catch (err: any) {
        setError(err.message || "Αποτυχία φόρτωσης προφίλ");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

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

  async function loadUserFiles() {
    if (!userId) return;
    setFilesLoading(true);
    try {
      const res = await fetch("/api/files?scope=all", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        const all = (j.files || []) as FileItem[];
        setFiles(all.filter((f) => fileBelongsToUser(f, userId)));
      }
    } finally {
      setFilesLoading(false);
    }
  }

  async function loadFolders() {
    if (!userId) return;
    setLoadingFolders(true);
    try {
      const res = await fetch(`/api/pdf-folders?scope=admin&userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setFolders(j.folders || []);
    } finally {
      setLoadingFolders(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    loadUserFiles();
    loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function uploadForUser() {
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
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Αποτυχία upload");
      }

      setUpTitle("");
      setUpFile(null);
      await loadUserFiles();
    } catch (e: any) {
      alert(e?.message || "Σφάλμα upload");
    } finally {
      setUploading(false);
    }
  }

  async function movePdf(fileId: string, pdfFolderId: string | null) {
    const res = await fetch(`/api/files/${fileId}/pdf-folder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfFolderId, userId }),
    });
    if (!res.ok) {
      alert("Αποτυχία μετακίνησης PDF.");
      return;
    }
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, pdfFolderId } : f)));
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
        body: JSON.stringify({ name, userId, scope: "admin" }),
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

  async function renameFolder(folderId: string, current: string) {
    if (!userId) return;
    const name = prompt("Νέο όνομα φακέλου:", current)?.trim();
    if (!name || name === current) return;

    const res = await fetch(`/api/pdf-folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, userId, scope: "admin" }),
    });
    if (!res.ok) {
      alert("Αποτυχία μετονομασίας.");
      return;
    }
    await loadFolders();
  }

  async function deleteFolder(folderId: string) {
    if (!userId) return;
    if (!confirm("Διαγραφή φακέλου; (τα PDF δεν θα διαγραφούν, απλά θα βγουν από τον φάκελο)")) return;

    const res = await fetch(`/api/pdf-folders/${folderId}?scope=admin&userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("Αποτυχία διαγραφής φακέλου.");
      return;
    }

    setFiles((prev) => prev.map((f) => (f.pdfFolderId === folderId ? { ...f, pdfFolderId: null } : f)));
    setFolderFilter("ALL");
    await loadFolders();
  }

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      const t = (f.title || "").toLowerCase();
      const o = (f.originalName || "").toLowerCase();
      return t.includes(q) || o.includes(q);
    });
  }, [files, query]);

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
    <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Προφίλ πελάτη</h1>
          {user && (
            <p className="text-sm text-gray-500">
              {user.name || "—"} · {user.email}
            </p>
          )}
        </div>
      </header>

      {/* wider: on xl give more space to files column */}
      <div className="grid gap-6 lg:grid-cols-[minmax(540px,1fr)_minmax(720px,1.35fr)]">
        {/* LEFT: PROFILE */}
        <section className="min-w-0 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] shadow-sm p-4 space-y-5">
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
                <span className="text-sm">Αρχικά υπευθύνου καταγραφής</span>
                <input
                  className="w-full border rounded p-2 text-sm"
                  value={profile.supervisorInitials}
                  onChange={(e) => update("supervisorInitials", e.target.value)}
                />
              </label>
            </div>
          </div>

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

          <div>
            <h2 className="font-semibold mb-2">Εξοπλισμός αποθήκευσης/διατήρησης τροφίμων</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              <NumberField label="Αριθμός ψυγείων" value={profile.fridgeCount} onChange={(v) => update("fridgeCount", v)} />
              <NumberField label="Αριθμός καταψύξεων" value={profile.freezerCount} onChange={(v) => update("freezerCount", v)} />
              <NumberField label="Αριθμός θερμοθαλάμων / Bain Marie" value={profile.hotCabinetCount} onChange={(v) => update("hotCabinetCount", v)} />
              <NumberField label="Αριθμός θαλάμων Dry Aged" value={profile.dryAgedChamberCount} onChange={(v) => update("dryAgedChamberCount", v)} />
              <NumberField label="Αριθμός καταψύκτη/έκθεσης παγωτών" value={profile.iceCreamFreezerCount} onChange={(v) => update("iceCreamFreezerCount", v)} />
            </div>
          </div>

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

        {/* RIGHT: FILES */}
        <section className="min-w-0 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Αρχεία χρήστη</h2>
              <p className="text-xs text-gray-500">Upload & διαχείριση PDF φακέλων/αρχείων.</p>
            </div>

            <button
              onClick={async () => {
                await loadUserFiles();
                await loadFolders();
              }}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5"
            >
              Ανανέωση
            </button>
          </div>

          <div className="rounded-xl border bg-white p-3">
            <div className="font-medium mb-2">Upload αρχείου στον χρήστη</div>
            <div className="grid gap-2">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Τίτλος"
                value={upTitle}
                onChange={(e) => setUpTitle(e.target.value)}
              />
              <input
                type="file"
                className="w-full rounded-lg border px-3 py-2 bg-white text-sm"
                onChange={(e) => setUpFile(e.currentTarget.files?.[0] ?? null)}
              />
              <button
                onClick={uploadForUser}
                disabled={uploading}
                className="w-full rounded-lg bg-[color:var(--brand,#25C3F4)] text-black px-4 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {uploading ? "Upload…" : "Upload & Ανάθεση στον χρήστη"}
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση αρχείων…"
              className="w-full lg:max-w-[520px] rounded-xl border px-3 py-2 text-sm"
            />
            <div className="text-sm text-gray-500">
              {filteredFiles.length} αρχείο(α) · {pdfs.length} PDF
            </div>
          </div>

          {filesLoading ? (
            <div className="text-sm text-[color:var(--muted)]">Φόρτωση αρχείων…</div>
          ) : (
            <div className="grid gap-4">
              {/* ✅ wider 2-column inside right panel on xl */}
              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                {/* NON PDF */}
                <div className="rounded-xl border bg-white p-3">
                  <div className="font-semibold">Αρχεία (όχι PDF) ({others.length})</div>

                  {others.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">Δεν υπάρχουν αρχεία.</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      {/* ✅ table keeps width, scrolls if needed */}
                      <table className="min-w-[780px] w-full text-sm">
                        <colgroup>
                          <col className="w-[52%]" />
                          <col className="w-[26%]" />
                          <col className="w-[10%]" />
                          <col className="w-[12%]" />
                        </colgroup>
                        <thead className="bg-gray-50 text-gray-700">
                          <tr className="text-left">
                            <Th>Τίτλος</Th>
                            <Th className="whitespace-nowrap">Ανέβηκε</Th>
                            <Th className="whitespace-nowrap">Μέγεθος</Th>
                            <Th className="text-right whitespace-nowrap">Ενέργεια</Th>
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
                                      className="inline-block rounded-lg px-3 py-2 font-semibold text-black"
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
                </div>

                {/* PDF */}
                <div className="rounded-xl border bg-white p-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">PDF ({pdfs.length})</div>
                      <button
                        type="button"
                        onClick={createFolder}
                        disabled={creatingFolder}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
                      >
                        <Plus size={16} /> Φάκελος
                      </button>
                    </div>

                    {/* ✅ filter full width */}
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      value={folderFilter}
                      onChange={(e) => setFolderFilter(e.target.value)}
                    >
                      <option value="ALL">Όλα</option>
                      <option value="NONE">Χωρίς φάκελο</option>
                      {folders.map((fo) => (
                        <option key={fo.id} value={fo.id}>
                          {fo.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* folders */}
                  <div className="mt-3 rounded-xl border bg-gray-50 p-2 max-h-[220px] overflow-auto">
                    {loadingFolders ? (
                      <div className="text-sm text-gray-500 px-2 py-2">Φόρτωση φακέλων…</div>
                    ) : folders.length === 0 ? (
                      <div className="text-sm text-gray-500 px-2 py-2">Δεν υπάρχουν φάκελοι.</div>
                    ) : (
                      <div className="grid gap-1">
                        <FolderRow active={folderFilter === "ALL"} name="Όλα" onClick={() => setFolderFilter("ALL")} />
                        <FolderRow active={folderFilter === "NONE"} name="Χωρίς φάκελο" onClick={() => setFolderFilter("NONE")} />
                        <div className="my-1 h-px bg-gray-200" />
                        {folders.map((fo) => (
                          <div
                            key={fo.id}
                            className={[
                              "group flex items-center justify-between gap-2 rounded-lg px-2 py-2 cursor-pointer",
                              folderFilter === fo.id ? "bg-white border" : "hover:bg-white/70",
                            ].join(" ")}
                            onClick={() => setFolderFilter(fo.id)}
                            title={fo.name}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <Folder size={16} className="shrink-0" />
                              <div className="truncate text-sm">{fo.name}</div>
                            </div>

                            <div className="flex items-center gap-1 opacity-100 xl:opacity-0 xl:group-hover:opacity-100">
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-gray-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  renameFolder(fo.id, fo.name);
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
                                  deleteFolder(fo.id);
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
                    <p className="mt-4 text-sm text-gray-500">Δεν βρέθηκαν PDF.</p>
                  ) : (
                    <div className="mt-4 grid gap-2">
                      {pdfsFilteredByFolder.map((f) => {
                        const dt = new Date(f.createdAt);
                        return (
                          <div key={f.id} className="rounded-xl border p-3">
                            {/* ✅ grid prevents squeeze */}
                            <div className="grid gap-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <FileText size={16} className="shrink-0" />
                                    <div className="font-medium break-words">
                                      {f.title || f.originalName || "PDF"}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {dt.toLocaleDateString()} {dt.toLocaleTimeString()} · {formatSize(f.size)}
                                  </div>
                                </div>

                                {f.url ? (
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-black"
                                    style={{ backgroundColor: "var(--brand, #25C3F4)" }}
                                  >
                                    Λήψη
                                  </a>
                                ) : null}
                              </div>

                              <select
                                className="w-full rounded-lg border px-3 py-2 text-sm"
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
                            </div>
                          </div>
                        );
                      })}
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

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        min={0}
        className="w-full border rounded p-2 text-sm"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}
