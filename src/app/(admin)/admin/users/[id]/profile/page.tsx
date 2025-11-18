// src/app/(admin)/admin/users/[id]/profile/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Profile = {
  businessName: string;
  businessTypes: string[];
  equipmentCount: number | null;
  hasDryAged: boolean | null;
  supervisorInitials: string | null;
  equipmentFlags: Record<string, boolean> | null;

  closedDaysText: string | null;
  holidayClosedDates: string[];
  augustRange: { from: string | null; to: string | null } | null;
  easterRange: { from: string | null; to: string | null } | null;
};

type AdminProfileResponse = {
  ok: boolean;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  profile: Profile | null;
};

const BUSINESS_TYPES = [
  "ΕΣΤΙΑΤΟΡΙΟ – ΨΗΤΟΠΩΛΕΙΟ",
  "ΕΣΤΙΑΤΟΡΙΟ – ΨΗΤΟΠΩΛΕΙΟ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
  "BAR – WINE BAR",
  "ΑΝΑΨΥΚΤΗΡΙΟ – ΚΑΦΕΤΕΡΙΑ",
  "ΚΥΛΙΚΕΙΟ",
  "ΠΡΑΤΗΡΙΟ ΖΑΧ/ΚΗΣ – ΓΑΛΑΚΤΟΣ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΠΡΑΤΗΡΙΟ ΖΑΧ/ΚΗΣ – ΓΑΛΑΚΤΟΣ ΧΩΡΙΣ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΠΡΑΤΗΡΙΟ ΑΡΤΟΥ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΚΡΕΟΠΩΛΕΙΟ",
  "ΚΡΕΟΠΩΛΕΙΟ ΜΕ ΖΕΣΤΗ ΓΩΝΙΑ",
  "ΙΧΘΥΟΠΩΛΕΙΟ",
  "ΙΧΘΥΟΠΩΛΕΙΟ ΜΕ ΖΕΣΤΗ ΓΩΝΙΑ",
  "ΔΙΑΘΕΣΗ ΠΡΟΪΟΝΤΩΝ ΑΛΛΑΝΤΟΠΟΙΪΑΣ/ΤΥΡΟΚΟΜΙΑΣ",
  "ΑΡΤΟΠΟΙΕΙΟ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΑΡΤΟΠΟΙΕΙΟ ΧΩΡΙΣ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΑΡΤΟΠΟΙΕΙΟ – ΖΑΧΑΡΟΠΛΑΣΤΕΙΟ",
  "ΖΑΧΑΡΟΠΛΑΣΤΕΙΟ ΜΕ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΖΑΧΑΡΟΠΛΑΣΤΕΙΟ ΧΩΡΙΣ ΠΑΡΟΧΗ ΚΑΦΕ",
  "ΠΑΝΤΟΠΩΛΕΙΟ / ΟΠΩΡΟΠΩΛΕΙΟ",
  "ΚΑΒΑ – ΚΑΤΑΣΤΗΜΑ ΞΗΡΩΝ ΚΑΡΠΩΝ",
  "ΠΡΑΤΗΡΙΟ ΚΑΤΕΨΥΓΜΕΝΩΝ ΠΡΟΪΟΝΤΩΝ",
  "ΣΥΣΚΕΥΑΣΜΕΝΑ ΠΡΟΪΟΝΤΑ ΝΩΠΑ / ΚΑΤΕΨΥΓΜΕΝΑ / ΞΗΡΟΥ ΦΟΡΤΙΟΥ",
  "ΠΑΓΩΤΟΠΩΛΕΙΟ",
  "ΠΑΡΑΣΚΕΥΗ – ΠΩΛΗΣΗ ΣΦΟΛΙΑΤΟΕΙΔΩΝ ΠΡΟΪΟΝΤΩΝ",
];

const EQUIPMENT_FLAGS: { key: string; label: string }[] = [
  { key: "apagogiko", label: "Απαγωγικό σύστημα" },
  { key: "mixaniKafe", label: "Μηχανή καφέ" },
  { key: "apoxigantiras", label: "Αποξηραντής" },
  { key: "prosthikesVitrinas", label: "Προσθήκες έκθεσης τροφίμων" },
  { key: "kopisTyrokopikon", label: "Μηχανές κοπής τυροκομικών/αλλαντικών" },
  { key: "kopisKima", label: "Μηχανές κοπής κιμά" },
  { key: "snitselomixani", label: "Σνιτσελομηχανή" },
  { key: "pagomixani", label: "Παγομηχανή" },
  { key: "mixersZymotiria", label: "Μίξερ – ζυμωτήρια" },
];

function emptyProfile(): Profile {
  return {
    businessName: "",
    businessTypes: [],
    equipmentCount: null,
    hasDryAged: null,
    supervisorInitials: "",
    equipmentFlags: {},

    closedDaysText: "",
    holidayClosedDates: [],
    augustRange: { from: null, to: null },
    easterRange: { from: null, to: null },
  };
}

export default function AdminUserProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [draft, setDraft] = useState<Profile>(emptyProfile);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}/profile`, {
          cache: "no-store",
        });
        const json: AdminProfileResponse | any = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json?.error || "Αποτυχία φόρτωσης προφίλ");
        }

        const p: Profile | null = json.profile ?? null;
        const normalized: Profile = {
          ...emptyProfile(),
          ...(p || {}),
          holidayClosedDates: p?.holidayClosedDates || [],
          equipmentFlags: p?.equipmentFlags || {},
          augustRange: p?.augustRange ?? { from: null, to: null },
          easterRange: p?.easterRange ?? { from: null, to: null },
        };

        setDraft(normalized);
        if (json.user) {
          setUserName(json.user.name);
          setUserEmail(json.user.email);
        }
      } catch (e: any) {
        setError(e.message || "Σφάλμα");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  async function save() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...draft,
        equipmentFlags: draft.equipmentFlags ?? {},
        holidayClosedDates: draft.holidayClosedDates || [],
        augustRange: draft.augustRange,
        easterRange: draft.easterRange,
      };
      const res = await fetch(`/api/admin/users/${userId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || "Αποτυχία αποθήκευσης");
      }
    } catch (e: any) {
      setError(e.message || "Σφάλμα αποθήκευσης");
    } finally {
      setSaving(false);
    }
  }

  // helpers
  const eqFlags = draft.equipmentFlags || {};

  function toggleBusinessType(label: string) {
    setDraft((prev) => {
      const exists = prev.businessTypes.includes(label);
      return {
        ...prev,
        businessTypes: exists
          ? prev.businessTypes.filter((x) => x !== label)
          : [...prev.businessTypes, label],
      };
    });
  }

  function toggleEquipmentFlag(key: string) {
    setDraft((prev) => ({
      ...prev,
      equipmentFlags: {
        ...(prev.equipmentFlags || {}),
        [key]: !(prev.equipmentFlags || {})[key],
      },
    }));
  }

  function addHolidayDate() {
    setDraft((prev) => ({
      ...prev,
      holidayClosedDates: [...(prev.holidayClosedDates || []), ""],
    }));
  }

  function updateHolidayDate(index: number, value: string) {
    setDraft((prev) => {
      const arr = [...(prev.holidayClosedDates || [])];
      arr[index] = value;
      return { ...prev, holidayClosedDates: arr };
    });
  }

  function removeHolidayDate(index: number) {
    setDraft((prev) => {
      const arr = [...(prev.holidayClosedDates || [])];
      arr.splice(index, 1);
      return { ...prev, holidayClosedDates: arr };
    });
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Προφίλ επιχείρησης</h1>
        <p>Φόρτωση…</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Προφίλ επιχείρησης (Admin)</h1>
          {(userEmail || userName) && (
            <p className="text-sm text-gray-500">
              Χρήστης: {userName || "—"} ({userEmail || "—"})
            </p>
          )}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-[color:var(--brand,#07c1f6)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {saving ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card,#fff)] shadow-sm p-4">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {/* Επωνυμία + Αρχικά */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">
                Επωνυμία επιχείρησης
              </label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={draft.businessName}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, businessName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">
                Αρχικά υπευθύνου
              </label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={draft.supervisorInitials ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    supervisorInitials: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* Είδη επιχείρησης */}
          <div>
            <label className="text-xs font-medium text-gray-500">
              Είδος επιχείρησης (πολλαπλή επιλογή)
            </label>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {BUSINESS_TYPES.map((bt) => (
                <label
                  key={bt}
                  className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={draft.businessTypes.includes(bt)}
                    onChange={() => toggleBusinessType(bt)}
                  />
                  <span className="truncate">{bt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* c1 / c2 */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">
                Πλήθος εξοπλισμού συντήρησης (c1)
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={draft.equipmentCount ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    equipmentCount:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>

            <div className="space-y-2 flex items-center gap-3">
              <label className="text-xs font-medium text-gray-500">
                Dry aged (c2)
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!draft.hasDryAged}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, hasDryAged: e.target.checked }))
                  }
                />
                <span>Υπάρχει</span>
              </label>
            </div>
          </div>

          {/* Λοιπός εξοπλισμός */}
          <div>
            <label className="text-xs font-medium text-gray-500">
              Λοιπός εξοπλισμός
            </label>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {EQUIPMENT_FLAGS.map((eq) => (
                <label
                  key={eq.key}
                  className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!!eqFlags[eq.key]}
                    onChange={() => toggleEquipmentFlag(eq.key)}
                  />
                  <span className="truncate">{eq.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Closed days / holidays */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">
                Ποιες μέρες είναι κλειστά (κείμενο)
              </label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[60px]"
                value={draft.closedDaysText ?? ""}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    closedDaysText: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">
                Ποιες αργίες είναι κλειστά (πολλαπλές ημερομηνίες)
              </label>
              <div className="space-y-2">
                {(draft.holidayClosedDates || []).map((d, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="date"
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={d || ""}
                      onChange={(e) => updateHolidayDate(idx, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeHolidayDate(idx)}
                      className="text-xs text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addHolidayDate}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs"
                >
                  Προσθήκη ημερομηνίας
                </button>
              </div>
            </div>
          </div>

          {/* August / Easter ranges */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">
                Ποιο διάστημα του Αυγούστου είναι κλειστά;
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={draft.augustRange?.from || ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      augustRange: {
                        ...(p.augustRange || { from: null, to: null }),
                        from: e.target.value || null,
                      },
                    }))
                  }
                />
                <input
                  type="date"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={draft.augustRange?.to || ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      augustRange: {
                        ...(p.augustRange || { from: null, to: null }),
                        to: e.target.value || null,
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">
                Ποιο διάστημα του Πάσχα είναι κλειστά;
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={draft.easterRange?.from || ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      easterRange: {
                        ...(p.easterRange || { from: null, to: null }),
                        from: e.target.value || null,
                      },
                    }))
                  }
                />
                <input
                  type="date"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={draft.easterRange?.to || ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      easterRange: {
                        ...(p.easterRange || { from: null, to: null }),
                        to: e.target.value || null,
                      },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[color:var(--brand,#07c1f6)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
            >
              {saving ? "Αποθήκευση…" : "Αποθήκευση"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
