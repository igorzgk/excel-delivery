"use client";
import { useState } from "react";
import { BUSINESS_TYPES } from "@/lib/businessProfile";
import { useRouter } from "next/navigation";

type ProfilePayload = {
  businessName: string;
  businessTypes: string[];
  equipmentCount?: number;
  hasDryAged?: boolean;
  supervisorInitials?: string;
  equipmentFlags?: Record<string, boolean>;

  closedDaysText?: string;
  holidayClosedDates?: string[]; // YYYY-MM-DD[]
  augustRange?: { from: string; to: string };
  easterRange?: { from: string; to: string };
};

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Step 1 - account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 - full profile
  const [profile, setProfile] = useState<ProfilePayload>({
    businessName: "",
    businessTypes: [],
    equipmentCount: 0,
    hasDryAged: false,
    supervisorInitials: "",
    equipmentFlags: {},
    closedDaysText: "",
    holidayClosedDates: [],
    augustRange: { from: "", to: "" },
    easterRange: { from: "", to: "" },
  });

  const update = (k: keyof ProfilePayload, v: any) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const flagLabels: Record<string, string> = {
    extractorHood: "Απαγωγικό σύστημα",
    coffeeMachine: "Μηχανή καφέ",
    dehumidifier: "Αποξηραντής",
    foodDisplayAddons: "Προσθήκες έκθεσης τροφίμων",
    slicerDairyColdCuts: "Μηχανές κοπής τυροκομικών/αλλαντικών",
    meatGrinder: "Μηχανές κοπής κιμά",
    schnitzelMachine: "Σνιτσελομηχανή",
    iceMaker: "Παγομηχανή",
    mixerDough: "Μίξερ – ζυμωτήρια",
  };

  async function submitAll() {
    setLoading(true);
    setError(null);

    // client-side sanity so user gets immediate feedback
    if (!profile.businessName?.trim()) {
      setLoading(false);
      setError("Συμπληρώστε την επωνυμία επιχείρησης.");
      return;
    }
    if (!profile.businessTypes?.length) {
      setLoading(false);
      setError("Επιλέξτε τουλάχιστον ένα είδος επιχείρησης.");
      return;
    }

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
    setLoading(false);

    if (res.ok) {
      setStep(3);
      return;
    }
    const j = await res.json().catch(() => ({}));
    // common causes: ALLOW_SIGNUPS!=true, duplicate email, invalid payload
    setError(
      j?.error === "invalid_payload"
        ? "Τα στοιχεία προφίλ δεν είναι έγκυρα. Ελέγξτε τα πεδία."
        : j?.error === "Email already in use"
        ? "Το email χρησιμοποιείται ήδη."
        : j?.error === "Signups are disabled"
        ? "Οι εγγραφές είναι απενεργοποιημένες (ALLOW_SIGNUPS)."
        : "Αποτυχία εγγραφής"
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Εγγραφή</h1>

      {/* STEP 1: Account */}
      {step === 1 && (
        <section className="rounded-2xl border bg-white p-4 space-y-3">
          <label className="block">
            <span className="text-sm">Ονοματεπώνυμο</span>
            <input
              className="w-full border rounded p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm">Email</span>
            <input
              type="email"
              className="w-full border rounded p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm">Κωδικός</span>
            <input
              type="password"
              className="w-full border rounded p-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <div className="flex justify-end">
            <button
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
              onClick={() => setStep(2)}
            >
              Συνέχεια
            </button>
          </div>
        </section>
      )}

      {/* STEP 2: Full business profile */}
      {step === 2 && (
        <section className="rounded-2xl border bg-white p-4 space-y-5">
          <h2 className="font-semibold">Προφίλ επιχείρησης</h2>

          <label className="block">
            <span className="text-sm">Επωνυμία επιχείρησης</span>
            <input
              className="w-full border rounded p-2"
              value={profile.businessName}
              onChange={(e) => update("businessName", e.target.value)}
            />
          </label>

          {/* Business Types */}
          <div>
            <div className="text-sm mb-1">Είδος επιχείρησης (πολλαπλή)</div>
            <div className="grid md:grid-cols-2 gap-2">
              {BUSINESS_TYPES.map((bt) => (
                <label key={bt} className="flex items-center gap-2 border rounded p-2">
                  <input
                    type="checkbox"
                    checked={profile.businessTypes.includes(bt)}
                    onChange={(e) => {
                      const set = new Set(profile.businessTypes);
                      e.target.checked ? set.add(bt) : set.delete(bt);
                      update("businessTypes", Array.from(set));
                    }}
                  />
                  <span className="text-sm">{bt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* C) Equipment count + dry-aged + initials */}
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm">Πλήθος εξοπλισμού συντήρησης (c1)</span>
              <input
                type="number"
                min={0}
                className="w-full border rounded p-2"
                value={profile.equipmentCount ?? 0}
                onChange={(e) => update("equipmentCount", Number(e.target.value) || 0)}
              />
            </label>

            <label className="block">
              <span className="text-sm">Dry aged (c2)</span>
              <div className="mt-2">
                <input
                  type="checkbox"
                  checked={!!profile.hasDryAged}
                  onChange={(e) => update("hasDryAged", e.target.checked)}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm">Αρχικά υπευθύνου (D)</span>
              <input
                className="w-full border rounded p-2"
                value={profile.supervisorInitials ?? ""}
                onChange={(e) => update("supervisorInitials", e.target.value)}
              />
            </label>
          </div>

          {/* E) Equipment flags */}
          <div>
            <div className="text-sm mb-1">Λοιπός εξοπλισμός (E)</div>
            <div className="grid md:grid-cols-2 gap-2">
              {Object.entries(flagLabels).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 border rounded p-2">
                  <input
                    type="checkbox"
                    checked={!!profile.equipmentFlags?.[key]}
                    onChange={(e) =>
                      update("equipmentFlags", {
                        ...(profile.equipmentFlags || {}),
                        [key]: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Closed info */}
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm">Ποιες μέρες είναι κλειστά η επιχείρηση;</span>
              <input
                className="w-full border rounded p-2"
                value={profile.closedDaysText ?? ""}
                onChange={(e) => update("closedDaysText", e.target.value)}
              />
            </label>

            <div>
              <span className="text-sm">Αργίες (πολλαπλές ημερομηνίες)</span>
              <HolidayEditor
                dates={profile.holidayClosedDates ?? []}
                onChange={(dates) => update("holidayClosedDates", dates)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <RangeInput
              label="Αύγουστος (διάστημα)"
              value={profile.augustRange || { from: "", to: "" }}
              onChange={(v) => update("augustRange", v)}
            />
            <RangeInput
              label="Πάσχα (διάστημα)"
              value={profile.easterRange || { from: "", to: "" }}
              onChange={(v) => update("easterRange", v)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-between">
            <button className="rounded-xl px-4 py-2 text-sm" onClick={() => setStep(1)}>
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
            <button className="rounded-xl px-4 py-2 text-sm underline" onClick={() => router.push("/login")}>
              Μετάβαση στη σελίδα σύνδεσης
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- small helpers ---------- */

function HolidayEditor({
  dates,
  onChange,
}: {
  dates: string[];
  onChange: (d: string[]) => void;
}) {
  const [tmp, setTmp] = useState("");
  return (
    <div className="mt-1">
      <div className="flex gap-2">
        <input type="date" className="border rounded p-2" value={tmp} onChange={(e) => setTmp(e.target.value)} />
        <button
          type="button"
          className="rounded px-3 py-2"
          style={{ background: "var(--brand,#25C3F4)", color: "#061630" }}
          onClick={() => {
            if (!tmp) return;
            const set = new Set(dates);
            set.add(tmp);
            onChange(Array.from(set).sort());
            setTmp("");
          }}
        >
          Προσθήκη
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {dates.map((d) => (
          <span key={d} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
            {d}
            <button onClick={() => onChange(dates.filter((x) => x !== d))}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

function RangeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { from: string; to: string };
  onChange: (v: { from: string; to: string }) => void;
}) {
  return (
    <div>
      <div className="text-sm mb-1">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          className="border rounded p-2"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
        <input
          type="date"
          className="border rounded p-2"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </div>
    </div>
  );
}
