"use client";
import { useState } from "react";
import { BUSINESS_TYPES } from "@/lib/businessProfile";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [step, setStep] = useState<1|2|3>(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Step 1 – account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 – profile (subset; same shape as /profile page)
  const [profile, setProfile] = useState<any>({
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

  function upProfile(k: string, v: any) { setProfile((p: any) => ({ ...p, [k]: v })); }

  async function submitAll() {
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, profile }),
    });
    setLoading(false);
    if (res.ok) setStep(3);
    else alert("Αποτυχία εγγραφής");
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Εγγραφή</h1>

      {step === 1 && (
        <section className="rounded-2xl border bg-white p-4 space-y-3">
          <label className="block">
            <span className="text-sm">Ονοματεπώνυμο</span>
            <input className="w-full border rounded p-2" value={name} onChange={e=>setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm">Email</span>
            <input type="email" className="w-full border rounded p-2" value={email} onChange={e=>setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm">Κωδικός</span>
            <input type="password" className="w-full border rounded p-2" value={password} onChange={e=>setPassword(e.target.value)} />
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

      {step === 2 && (
        <section className="rounded-2xl border bg-white p-4 space-y-4">
          <h2 className="font-semibold">Προφίλ επιχείρησης</h2>
          <label className="block">
            <span className="text-sm">Επωνυμία επιχείρησης</span>
            <input className="w-full border rounded p-2"
                   value={profile.businessName}
                   onChange={e=>upProfile("businessName", e.target.value)} />
          </label>

          <div>
            <div className="text-sm mb-1">Είδος επιχείρησης (πολλαπλή)</div>
            <div className="grid md:grid-cols-2 gap-2">
              {BUSINESS_TYPES.map(bt => (
                <label key={bt} className="flex items-center gap-2 border rounded p-2">
                  <input
                    type="checkbox"
                    checked={profile.businessTypes.includes(bt)}
                    onChange={e => {
                      const set = new Set(profile.businessTypes);
                      e.target.checked ? set.add(bt) : set.delete(bt);
                      upProfile("businessTypes", Array.from(set));
                    }}
                  />
                  <span className="text-sm">{bt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* keep it short here; user can refine later in /profile */}
          <label className="block">
            <span className="text-sm">Αρχικά υπευθύνου</span>
            <input className="w-full border rounded p-2"
                   value={profile.supervisorInitials}
                   onChange={e=>upProfile("supervisorInitials", e.target.value)} />
          </label>

          <div className="flex justify-between">
            <button className="rounded-xl px-4 py-2 text-sm"
                    onClick={() => setStep(1)}>Πίσω</button>
            <button className="rounded-xl px-4 py-2 text-sm font-semibold"
                    style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
                    disabled={loading}
                    onClick={submitAll}>
              {loading ? "Αποστολή…" : "Ολοκλήρωση εγγραφής"}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-semibold mb-2">Ευχαριστούμε!</h2>
          <p className="text-sm">
            Ο λογαριασμός δημιουργήθηκε και αναμένει έγκριση από διαχειριστή.
            Θα ενημερωθείτε με email μόλις ενεργοποιηθεί.
          </p>
          <div className="mt-4">
            <button className="rounded-xl px-4 py-2 text-sm underline"
                    onClick={() => router.push("/login")}>
              Μετάβαση στη σελίδα σύνδεσης
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
