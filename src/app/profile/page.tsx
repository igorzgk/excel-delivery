"use client";
import { useEffect, useState } from "react";
import { BUSINESS_TYPES } from "@/lib/businessProfile";

type Profile = {
  businessName: string;
  businessTypes: string[];
  equipmentCount?: number | null;
  hasDryAged?: boolean | null;
  supervisorInitials?: string | null;
  equipmentFlags?: Record<string, boolean>;
};

export default function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/profile", { cache: "no-store" });
      const j = await r.json();
      setP(j.profile || { businessName: "", businessTypes: [], equipmentFlags: {} });
    })();
  }, []);

  if (!p) return <div className="p-6">Φόρτωση…</div>;

  function update<K extends keyof Profile>(k: K, v: Profile[K]) { setP({ ...p, [k]: v }); }

  async function save() {
    setSaving(true);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    setSaving(false);
  }

  const flags = {
    extractorHood: "Απαγωγικό σύστημα",
    coffeeMachine: "Μηχανή καφέ",
    dehumidifier: "Αποχηνότητα",
    foodDisplayAddons: "Προσθήκες έκθεσης τροφίμων",
    slicerDairyColdCuts: "Μηχανές κοπής τυροκομικών/αλλαντικών",
    meatGrinder: "Μηχανές κοπής κιμά",
    schnitzelMachine: "Σνιτσελομηχανή",
    iceMaker: "Παγομηχανή",
    mixerDough: "Μίξερ – ζυμωτήρια",
  } as const;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Προφίλ επιχείρησης</h1>

      <div className="rounded-2xl border bg-white p-4 space-y-3">
        <label className="block">
          <span className="text-sm">Επωνυμία επιχείρησης</span>
          <input className="w-full border rounded p-2"
                 value={p.businessName}
                 onChange={e => update("businessName", e.target.value)} />
        </label>

        <div>
          <div className="text-sm mb-1">Είδος επιχείρησης (πολλαπλή επιλογή)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BUSINESS_TYPES.map(bt => (
              <label key={bt} className="flex items-center gap-2 border rounded p-2">
                <input
                  type="checkbox"
                  checked={p.businessTypes.includes(bt)}
                  onChange={e => {
                    const next = new Set(p.businessTypes);
                    e.target.checked ? next.add(bt) : next.delete(bt);
                    update("businessTypes", Array.from(next));
                  }}
                />
                <span className="text-sm">{bt}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm">Πλήθος εξοπλισμού συντήρησης (c1)</span>
            <input type="number" min={0} className="w-full border rounded p-2"
                   value={p.equipmentCount ?? 0}
                   onChange={e => update("equipmentCount", Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-sm">Dry aged (c2)</span><br />
            <input type="checkbox"
                   checked={!!p.hasDryAged}
                   onChange={e => update("hasDryAged", e.target.checked)} />
          </label>
          <label className="block">
            <span className="text-sm">Αρχικά υπευθύνου</span>
            <input className="w-full border rounded p-2"
                   value={p.supervisorInitials ?? ""}
                   onChange={e => update("supervisorInitials", e.target.value)} />
          </label>
        </div>

        <div>
          <div className="text-sm mb-1">Λοιπός εξοπλισμός</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {Object.entries(flags).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 border rounded p-2">
                <input
                  type="checkbox"
                  checked={!!p.equipmentFlags?.[k]}
                  onChange={e => update("equipmentFlags", { ...p.equipmentFlags, [k]: e.target.checked })}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={save}
                  disabled={saving}
                  className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}>
            {saving ? "Αποθήκευση…" : "Αποθήκευση"}
          </button>
        </div>
      </div>
    </div>
  );
}
