"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}/profile`, {
          cache: "no-store",
        });
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

  if (loading || !profile) {
    return (
      <div className="p-6">
        <p className="text-sm text-[color:var(--muted)]">Φόρτωση…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
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
                <label
                  key={key}
                  className="flex items-center gap-2 border rounded p-2 text-sm"
                >
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
            <NumberField label="Αριθμός καταψύκτη/έκθεσης παγωτών" value={profile.iceCreamFreezerCount} onChange={(v) => update("iceCreamFreezerCount", v)} />
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
                        checked
                          ? "bg-[color:var(--brand,#25C3F4)] text-black border-transparent"
                          : "border-gray-300",
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
                onChange={(e) =>
                  update("augustRange", { ...profile.augustRange, from: e.target.value })
                }
              />
              <input
                type="date"
                className="border rounded p-2 text-sm"
                value={profile.augustRange.to}
                onChange={(e) =>
                  update("augustRange", { ...profile.augustRange, to: e.target.value })
                }
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
              style={{
                borderColor: "var(--border)",
                backgroundColor: "rgba(37,195,244,.12)",
                color: "#061630",
              }}
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
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
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
