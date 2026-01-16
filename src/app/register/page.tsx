// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// enums as string unions (να ταιριάζουν με Prisma enums)
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

  augustRange: { from: string; to: string }; // YYYY-MM-DD
};

const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "RESTAURANT_GRILL", label: "Εστιατόριο - Ψητοπωλείο" },
  { value: "RESTAURANT_GRILL_HYGIENE_WITH_COFFEE", label: "ΥΓΙΕΙΝΗ ΕΣΤΙΑΤΟΡΙΑ - ΨΗΤΟΠΩΛΕΙΑ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ" },
  { value: "BAR_WINE", label: "Bar – Wine Bar" },
  { value: "REFRESHMENT_CAFE", label: "Αναψυκτήριο – καφετέρια" },
  { value: "SCHOOL_KIOSK", label: "Σχολικό κυλικείο" },
  { value: "PASTRY_SHOP_WITH_COFFEE", label: "Πρατήριο ζαχ/κής - γάλακτος με παροχή καφέ" },
  { value: "PASTRY_SHOP_NO_COFFEE", label: "Πρατήριο ζαχ/κής χωρίς παροχή καφέ" },
  { value: "BREAD_SHOP_WITH_COFFEE", label: "Πρατήριο άρτου με παροχή καφέ" },
  { value: "BUTCHER", label: "Κρεοπωλείο" },
  { value: "BUTCHER_HOT_CORNER", label: "Κρεοπωλείο με ζεστή γωνιά" },
  { value: "FISHMONGER", label: "Ιχθυοπωλείο" },
  { value: "FISHMONGER_HOT_CORNER", label: "Ιχθυοπωλείο με ζεστή γωνιά" },
  { value: "DELI_CHEESE_CURED_MEAT", label: "Διάθεση προϊόντων αλλαντοποιίας / τυροκομίας" },
  { value: "BAKERY_WITH_COFFEE", label: "Αρτοποιείο με παροχή καφέ" },
  { value: "BAKERY_NO_COFFEE", label: "Αρτοποιείο χωρίς παροχή καφέ" },
  { value: "BAKERY_PASTRY_WITH_COFFEE", label: "Αρτοποιείο – Ζαχαροπλαστείο με παροχή καφέ" },
  { value: "PASTRY_WITH_COFFEE", label: "Ζαχαροπλαστείο με παροχή καφέ" },
  { value: "PASTRY_NO_COFFEE", label: "Ζαχαροπλαστείο χωρίς παροχή καφέ" },
  { value: "GROCERY_FRUIT", label: "Παντοπωλείο / οπωροπωλείο" },
  { value: "WINE_NUTS_SHOP", label: "Κάβα / κατάστημα ξηρών καρπών" },
  { value: "FROZEN_PRODUCTS_SHOP", label: "Πρατήριο κατεψυγμένων προϊόντων" },
  { value: "PACKAGED_FRESH_FROZEN_DRY", label: "Συσκευασμένα προϊόντα νωπά/κατεψυγμένα/ξηρού φορτίου" },
  { value: "ICE_CREAM_SHOP", label: "Παγωτοπωλείο" },
  { value: "PUFF_PASTRY_PRODUCTION", label: "Παρασκευή – πώληση σφολιατοειδών προϊόντων" },
];

const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: "MONDAY", label: "Δευτέρα" },
  { value: "TUESDAY", label: "Τρίτη" },
  { value: "WEDNESDAY", label: "Τετάρτη" },
  { value: "THURSDAY", label: "Πέμπτη" },
  { value: "FRIDAY", label: "Παρασκευή" },
  { value: "SATURDAY", label: "Σάββατο" },
  { value: "SUNDAY", label: "Κυριακή" },
];

const HOLIDAY_OPTIONS: { value: PublicHoliday; label: string }[] = [
  { value: "NEW_YEAR", label: "01/01 (Πρωτοχρονιά)" },
  { value: "THEOPHANY_JAN_6", label: "06/01 (Θεοφάνεια)" },
  { value: "CLEAN_MONDAY", label: "Καθαρά Δευτέρα" },
  { value: "MARCH_25", label: "25/03 (Εθνική εορτή)" },
  { value: "EASTER_SUNDAY", label: "Κυριακή του Πάσχα" },
  { value: "EASTER_MONDAY", label: "Δευτέρα του Πάσχα" },
  { value: "AUG_15", label: "15/08 (Κοίμηση Θεοτόκου)" },
  { value: "OCT_28", label: "28/10 (Εθνική εορτή)" },
  { value: "CHRISTMAS", label: "25/12 (Χριστούγεννα)" },
  { value: "BOXING_DAY", label: "26/12 (Επίσημη αργία)" },
];

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Βήμα 1 – Account fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Βήμα 2 – Profile fields
  const [profile, setProfile] = useState<ProfilePayload>({
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
  
  const updateProfile = <K extends keyof ProfilePayload>(
    key: K,
    value: ProfilePayload[K]
  ) => setProfile((prev) => ({ ...prev, [key]: value }));

  const canGoStep2 =
            name.trim().length >= 2 &&
            /\S+@\S+\.\S+/.test(email) &&
            password.length >= 6;

  async function submitAll() {
    setLoading(true);
    setError(null);

    if (!profile.businessName.trim()) {
      setLoading(false);
      setError("Συμπληρώστε την επωνυμία επιχείρησης.");
      return;
    }
    if (!profile.businessTypes.length) {
      setLoading(false);
      setError("Επιλέξτε τουλάχιστον ένα είδος επιχείρησης.");
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          profile,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(
          j?.error === "Email already in use"
            ? "Το email χρησιμοποιείται ήδη."
            : j?.error === "Signups are disabled"
            ? "Οι εγγραφές είναι απενεργοποιημένες."
            : j?.error === "invalid_payload"
            ? "Τα στοιχεία προφίλ δεν είναι έγκυρα. Ελέγξτε τα πεδία."
            : "Αποτυχία εγγραφής"
        );
        setLoading(false);
        return;
      }

      setStep(3);
      setLoading(false);
    } catch (err) {
      setError("Σφάλμα δικτύου κατά την εγγραφή.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Εγγραφή</h1>

      {/* STEP 1: Account */}
      {step === 1 && (
        <section className="rounded-2xl border bg-white p-4 space-y-3">
          <label className="block">
            <span className="text-sm">Ονοματεπώνυμο</span>
            <input required
              className="w-full border rounded p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm">Email</span>
            <input required
              type="email"
              className="w-full border rounded p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm">Κωδικός</span>
            <input required
              type="password"
              className="w-full border rounded p-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Ο κωδικός πρέπει να έχει τουλάχιστον 7 χαρακτήρες.
            </p>
          </label>

          <div className="flex justify-end">
            <button
              className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
              disabled={!canGoStep2}
              onClick={() => {
                if (!canGoStep2) {
                  setError("Συμπληρώστε σωστά Όνομα, Email και Κωδικό (>=6 χαρακτήρες) για να συνεχίσετε.");
                  return;
                }
                setError(null);
                setStep(2);
              }}
            >
              Συνέχεια
            </button>
          </div>
        </section>
      )}

      {/* STEP 2: Business profile */}
      {step === 2 && (
        <section className="rounded-2xl border bg-white p-4 space-y-5">
          <h2 className="font-semibold mb-2">Προφίλ επιχείρησης</h2>

          {/* 1) Επωνυμία */}
          <label className="block">
            <span className="text-sm">Επωνυμία επιχείρησης</span>
            <input
              className="w-full border rounded p-2"
              value={profile.businessName}
              onChange={(e) => updateProfile("businessName", e.target.value)}
            />
          </label>

          {/* 2) Business types */}
          <div>
            <div className="text-sm mb-1">
              Είδος επιχείρησης (μπορείτε να επιλέξετε περισσότερες από μία)
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {BUSINESS_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 border rounded p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={profile.businessTypes.includes(opt.value)}
                    onChange={(e) => {
                      const set = new Set(profile.businessTypes);
                      e.target.checked ? set.add(opt.value) : set.delete(opt.value);
                      updateProfile("businessTypes", Array.from(set) as BusinessType[]);
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3) Εξοπλισμός συντήρησης */}
          <div>
            <div className="text-sm mb-1">
              Πλήθος εξοπλισμού αποθήκευσης/διατήρησης τροφίμων
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Συμπληρώστε 0 αν δεν διαθέτετε κάποιον από τους παρακάτω εξοπλισμούς.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              <NumberField
                label="Αριθμός ψυγείων"
                value={profile.fridgeCount}
                onChange={(v) => updateProfile("fridgeCount", v)}
              />
              <NumberField
                label="Αριθμός καταψύξεων"
                value={profile.freezerCount}
                onChange={(v) => updateProfile("freezerCount", v)}
              />
              <NumberField
                label="Αριθμός θερμοθαλάμων / Bain Marie"
                value={profile.hotCabinetCount}
                onChange={(v) => updateProfile("hotCabinetCount", v)}
              />
              <NumberField
                label="Αριθμός θαλάμων Dry Aged"
                value={profile.dryAgedChamberCount}
                onChange={(v) => updateProfile("dryAgedChamberCount", v)}
              />
              <NumberField
                label="Αριθμός καταψύκτη/έκθεσης παγωτών"
                value={profile.iceCreamFreezerCount}
                onChange={(v) => updateProfile("iceCreamFreezerCount", v)}
              />
            </div>
          </div>

          {/* 4) Αρχικά υπευθύνου */}
          <label className="block">
            <span className="text-sm">
              Αρχικά υπευθύνου καταγραφής (π.χ. Α.Β.)
            </span>
            <input
              className="w-full border rounded p-2"
              value={profile.supervisorInitials}
              onChange={(e) => updateProfile("supervisorInitials", e.target.value)}
            />
          </label>

          {/* 5) Μέρες εβδομάδας κλειστά */}
          <div>
            <div className="text-sm mb-1">
              Ποιες μέρες είναι κλειστά η επιχείρηση;
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Αν δεν υπάρχει καμία κλειστή μέρα, αφήστε τα κενά.
            </p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((opt) => {
                const checked = profile.closedWeekdays.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      const set = new Set(profile.closedWeekdays);
                      checked ? set.delete(opt.value) : set.add(opt.value);
                      updateProfile(
                        "closedWeekdays",
                        Array.from(set) as Weekday[]
                      );
                    }}
                    className={[
                      "px-3 py-1 rounded-full border text-sm",
                      checked
                        ? "bg-[color:var(--brand,#25C3F4)] text-black border-transparent"
                        : "border-gray-300",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6) Αργίες */}
          <div>
            <div className="text-sm mb-1">
              Ποιες αργίες παραμένει κλειστή η επιχείρηση;
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {HOLIDAY_OPTIONS.map((opt) => {
                const checked = profile.closedHolidays.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 border rounded p-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const set = new Set(profile.closedHolidays);
                        e.target.checked ? set.add(opt.value) : set.delete(opt.value);
                        updateProfile(
                          "closedHolidays",
                          Array.from(set) as PublicHoliday[]
                        );
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 7) Αυγουστος διάστημα */}
          <div>
            <div className="text-sm mb-1">
              Ποιο διάστημα του Αυγούστου είναι κλειστά;
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Παράδειγμα: 2025-08-10 έως 2025-08-23
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="border rounded p-2 text-sm"
                value={profile.augustRange.from}
                onChange={(e) =>
                  updateProfile("augustRange", {
                    ...profile.augustRange,
                    from: e.target.value,
                  })
                }
              />
              <input
                type="date"
                className="border rounded p-2 text-sm"
                value={profile.augustRange.to}
                onChange={(e) =>
                  updateProfile("augustRange", {
                    ...profile.augustRange,
                    to: e.target.value,
                  })
                }
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-between">
            <button
              className="rounded-xl px-4 py-2 text-sm"
              onClick={() => setStep(1)}
            >
              Πίσω
            </button>
            <button
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
              disabled={loading}
              onClick={submitAll}
            >
              {loading ? "Αποστολή…" : "Ολοκλήρωση εγγραφής"}
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: Done */}
      {step === 3 && (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold mb-2">Ευχαριστούμε!</h2>
          <p className="text-sm">
            Ο λογαριασμός δημιουργήθηκε και αναμένει έγκριση από διαχειριστή.
            Θα ενημερωθείτε με email μόλις ενεργοποιηθεί.
          </p>
          <div className="mt-4">
            <button
              className="rounded-xl px-4 py-2 text-sm underline"
              onClick={() => router.push("/login")}
            >
              Μετάβαση στη σελίδα σύνδεσης
            </button>
          </div>
        </section>
      )}
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
