"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Profile = {
  businessName: string;
  businessTypes: string[];
  equipmentCount?: number | null;
  hasDryAged?: boolean | null;
  supervisorInitials?: string | null;
  equipmentFlags?: Record<string, boolean>;
  closedDaysText?: string | null;
  holidayClosedDates?: string[]; // YYYY-MM-DD
  augustRange?: { from: string; to: string } | null;
  easterRange?: { from: string; to: string } | null;
};

const FLAG_LABELS: Record<string,string> = {
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

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tmpHoliday, setTmpHoliday] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/profile", { cache: "no-store" });
      const j = await r.json();
      setProfile(
        j.profile ?? {
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
        }
      );
    })();
  }, []);

  const eqEnabled = useMemo(
    () => Object.entries(profile?.equipmentFlags || {}).filter(([,v]) => !!v).map(([k]) => FLAG_LABELS[k] || k),
    [profile]
  );

  async function save() {
    if (!profile) return;
    setSaving(true);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setEdit(false);
  }

  if (!profile) return <div className="p-6">Φόρτωση…</div>;

  return (
    <div className="grid gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Προφίλ επιχείρησης</h1>
        {!edit ? (
          <button
            className="rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--brand,#25C3F4)", color: "#061630" }}
            onClick={() => setEdit(true)}
          >
            Επεξεργασία
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="rounded-xl px-3 py-2 text-sm" onClick={() => setEdit(false)}>Άκυρο</button>
            <button
              className="rounded-xl px-3 py-2 text-sm font-semibold"
              style={{ background: "var(--brand,#25C3F4)", color: "#061630" }}
              disabled={saving}
              onClick={save}
            >
              {saving ? "Αποθήκευση…" : "Αποθήκευση"}
            </button>
          </div>
        )}
      </div>

      {/* SUMMARY CARD (table-like) */}
      {!edit && (
        <section className="rounded-2xl border bg-[color:var(--card,#fff)] p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <SummaryRow label="Επωνυμία">{profile.businessName || "—"}</SummaryRow>
            <SummaryRow label="Αρχικά υπευθύνου">{profile.supervisorInitials || "—"}</SummaryRow>
            <SummaryRow label="Είδη επιχείρησης">
              {profile.businessTypes?.length ? profile.businessTypes.join(", ") : "—"}
            </SummaryRow>
            <SummaryRow label="Πλήθος εξοπλισμού συντήρησης (c1)">
              {profile.equipmentCount ?? "—"}
            </SummaryRow>
            <SummaryRow label="Dry aged (c2)">{profile.hasDryAged ? "Ναι" : "Όχι"}</SummaryRow>
            <SummaryRow label="Λοιπός εξοπλισμός">
              {eqEnabled.length ? eqEnabled.join(", ") : "—"}
            </SummaryRow>
            <SummaryRow label="Ποιες μέρες είναι κλειστά;">
              {profile.closedDaysText || "—"}
            </SummaryRow>
            <SummaryRow label="Αργίες (ημερομηνίες)">
              {profile.holidayClosedDates?.length ? profile.holidayClosedDates.join(", ") : "—"}
            </SummaryRow>
            <SummaryRow label="Αύγουστος (διάστημα)">
              {profile.augustRange?.from && profile.augustRange?.to
                ? `${profile.augustRange.from} έως ${profile.augustRange.to}`
                : "—"}
            </SummaryRow>
            <SummaryRow label="Πάσχα (διάστημα)">
              {profile.easterRange?.from && profile.easterRange?.to
                ? `${profile.easterRange.from} έως ${profile.easterRange.to}`
                : "—"}
            </SummaryRow>
          </div>
        </section>
      )}

      {/* EDIT FORM */}
      {edit && (
        <section className="rounded-2xl border bg-[color:var(--card,#fff)] p-4 space-y-4">
          <label className="block">
            <span className="text-sm">Επωνυμία επιχείρησης</span>
            <input
              className="w-full border rounded p-2"
              value={profile.businessName}
              onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
            />
          </label>

          <div>
            <div className="text-sm mb-1">Είδος επιχείρησης (πολλαπλή)</div>
            <div className="grid md:grid-cols-2 gap-2">
              {(profile.businessTypes || []).concat([]) /* keep controlled */}
            </div>
            {/* We keep businessTypes as-is (already chosen during registration / admin can edit elsewhere if needed) */}
            <p className="text-xs text-[color:var(--muted)]">Οι κατηγορίες έχουν οριστεί κατά την εγγραφή.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm">Πλήθος εξοπλισμού συντήρησης (c1)</span>
              <input
                type="number"
                min={0}
                className="w-full border rounded p-2"
                value={profile.equipmentCount ?? 0}
                onChange={(e) =>
                  setProfile({ ...profile, equipmentCount: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="block">
              <span className="text-sm">Dry aged (c2)</span>
              <div className="mt-2">
                <input
                  type="checkbox"
                  checked={!!profile.hasDryAged}
                  onChange={(e) => setProfile({ ...profile, hasDryAged: e.target.checked })}
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm">Αρχικά υπευθύνου</span>
              <input
                className="w-full border rounded p-2"
                value={profile.supervisorInitials ?? ""}
                onChange={(e) =>
                  setProfile({ ...profile, supervisorInitials: e.target.value })
                }
              />
            </label>
          </div>

          <div>
            <div className="text-sm mb-1">Λοιπός εξοπλισμός</div>
            <div className="grid md:grid-cols-2 gap-2">
              {Object.entries(FLAG_LABELS).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 border rounded p-2">
                  <input
                    type="checkbox"
                    checked={!!profile.equipmentFlags?.[k]}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        equipmentFlags: { ...(profile.equipmentFlags || {}), [k]: e.target.checked },
                      })
                    }
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm">Ποιες μέρες είναι κλειστά (κείμενο)</span>
            <input
              className="w-full border rounded p-2"
              value={profile.closedDaysText ?? ""}
              onChange={(e) => setProfile({ ...profile, closedDaysText: e.target.value })}
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm mb-1">Αργίες (πολλαπλές ημερομηνίες)</div>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="border rounded p-2"
                  value={tmpHoliday}
                  onChange={(e) => setTmpHoliday(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded px-3 py-2"
                  style={{ background: "var(--brand,#25C3F4)", color: "#061630" }}
                  onClick={() => {
                    if (!tmpHoliday) return;
                    const set = new Set(profile.holidayClosedDates || []);
                    set.add(tmpHoliday);
                    setProfile({ ...profile, holidayClosedDates: Array.from(set).sort() });
                    setTmpHoliday("");
                  }}
                >
                  Προσθήκη
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(profile.holidayClosedDates || []).map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                    {d}
                    <button
                      onClick={() =>
                        setProfile({
                          ...profile,
                          holidayClosedDates: (profile.holidayClosedDates || []).filter((x) => x !== d),
                        })
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-sm mb-1">Αύγουστος (από)</div>
                <input
                  type="date"
                  className="w-full border rounded p-2"
                  value={profile.augustRange?.from || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      augustRange: { ...(profile.augustRange || {}), from: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <div className="text-sm mb-1">Αύγουστος (έως)</div>
                <input
                  type="date"
                  className="w-full border rounded p-2"
                  value={profile.augustRange?.to || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      augustRange: { ...(profile.augustRange || {}), to: e.target.value },
                    })
                  }
                />
              </div>

              <div className="mt-2">
                <div className="text-sm mb-1">Πάσχα (από)</div>
                <input
                  type="date"
                  className="w-full border rounded p-2"
                  value={profile.easterRange?.from || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      easterRange: { ...(profile.easterRange || {}), from: e.target.value },
                    })
                  }
                />
              </div>
              <div className="mt-2">
                <div className="text-sm mb-1">Πάσχα (έως)</div>
                <input
                  type="date"
                  className="w-full border rounded p-2"
                  value={profile.easterRange?.to || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      easterRange: { ...(profile.easterRange || {}), to: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px,1fr] items-start gap-3 border-b last:border-0 py-2">
      <div className="text-sm text-[color:var(--muted)]">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
