"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Profile = {
  businessName: string;
  businessTypes: string[];
  equipmentCount?: number | null;
  hasDryAged?: boolean | null;
  supervisorInitials?: string | null;
  equipmentFlags?: Record<string, boolean>;
  closedDaysText?: string | null;
  holidayClosedDates?: string[]; // YYYY-MM-DD[]
  augustRange?: { from: string; to: string } | null;
  easterRange?: { from: string; to: string } | null;
};

type UserLite = { id: string; email: string; name: string; status: string; role: string };

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

export default function AdminUserProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;
  const router = useRouter();

  const [user, setUser] = useState<UserLite | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tmpHoliday, setTmpHoliday] = useState("");

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const u = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
      if (u.ok) setUser(await u.json());

      const p = await fetch(`/api/admin/users/${userId}/profile`, { cache: "no-store" });
      if (p.ok) {
        const j = await p.json();
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
      }
    })();
  }, [userId]);

  const eqEnabled = useMemo(
    () => Object.entries(profile?.equipmentFlags || {}).filter(([,v]) => !!v).map(([k]) => FLAG_LABELS[k] || k),
    [profile]
  );

  async function save() {
    if (!profile || !userId) return;
    setSaving(true);
    const r = await fetch(`/api/admin/users/${userId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    if (r.ok) setEdit(false);
  }

  if (!user || !profile) return <div className="p-6">Φόρτωση…</div>;

  return (
    <div className="grid gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Προφίλ χρήστη</h1>
          <div className="text-sm text-[color:var(--muted)]">
            {user.name} — {user.email} · {user.status}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/users" className="underline text-sm">Πίσω στη λίστα</Link>
          {!edit ? (
            <button
              className="rounded-xl px-3 py-2 text-sm font-semibold"
              style={{ background: "var(--brand,#25C3F4)", color: "#061630" }}
              onClick={() => setEdit(true)}
            >
              Επεξεργασία
            </button>
          ) : (
            <>
              <button className="rounded-xl px-3 py-2 text-sm" onClick={() => setEdit(false)}>Άκυρο</button>
              <button
                className="rounded-xl px-3 py-2 text-sm font-semibold"
                style={{ background: "var(--brand,#25C3F4)", color: "#061630" }}
                disabled={saving}
                onClick={save}
              >
                {saving ? "Αποθήκευση…" : "Αποθήκευση"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* SUMMARY */}
      {!edit && (
        <section className="rounded-2xl border bg-[color:var(--card,#fff)] p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Row label="Επωνυμία">{profile.businessName || "—"}</Row>
            <Row label="Αρχικά υπευθύνου">{profile.supervisorInitials || "—"}</Row>
            <Row label="Είδη επιχείρησης">
              {profile.businessTypes?.length ? profile.businessTypes.join(", ") : "—"}
            </Row>
            <Row label="Πλήθος εξοπλισμού συντήρησης (c1)">{profile.equipmentCount ?? "—"}</Row>
            <Row label="Dry aged (c2)">{profile.hasDryAged ? "Ναι" : "Όχι"}</Row>
            <Row label="Λοιπός εξοπλισμός">
              {eqEnabled.length ? eqEnabled.join(", ") : "—"}
            </Row>
            <Row label="Ποιες μέρες είναι κλειστά (κείμενο)">{profile.closedDaysText || "—"}</Row>
            <Row label="Αργίες">{profile.holidayClosedDates?.length ? profile.holidayClosedDates.join(", ") : "—"}</Row>
            <Row label="Αύγουστος">{profile.augustRange?.from && profile.augustRange?.to ? `${profile.augustRange.from} έως ${profile.augustRange.to}` : "—"}</Row>
            <Row label="Πάσχα">{profile.easterRange?.from && profile.easterRange?.to ? `${profile.easterRange.from} έως ${profile.easterRange.to}` : "—"}</Row>
          </div>
        </section>
      )}

      {/* EDIT */}
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

          <div className="grid sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm">Πλήθος εξοπλισμού συντήρησης (c1)</span>
              <input
                type="number"
                min={0}
                className="w-full border rounded p-2"
                value={profile.equipmentCount ?? 0}
                onChange={(e) => setProfile({ ...profile, equipmentCount: Number(e.target.value) || 0 })}
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
                onChange={(e) => setProfile({ ...profile, supervisorInitials: e.target.value })}
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
                <input type="date" className="border rounded p-2" value={tmpHoliday} onChange={(e) => setTmpHoliday(e.target.value)} />
                <button
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
                    setProfile({ ...profile, augustRange: { ...(profile.augustRange || {}), from: e.target.value } })
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
                    setProfile({ ...profile, augustRange: { ...(profile.augustRange || {}), to: e.target.value } })
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
                    setProfile({ ...profile, easterRange: { ...(profile.easterRange || {}), from: e.target.value } })
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
                    setProfile({ ...profile, easterRange: { ...(profile.easterRange || {}), to: e.target.value } })
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[240px,1fr] items-start gap-3 border-b last:border-0 py-2">
      <div className="text-sm text-[color:var(--muted)]">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
