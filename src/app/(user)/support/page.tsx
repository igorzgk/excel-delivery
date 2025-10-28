// src/app/(user)/support/page.tsx
"use client";

import React from "react";

export default function SupportPage() {
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [priority, setPriority] = React.useState<"low" | "normal" | "high">("normal");
  const [status, setStatus] = React.useState<"idle" | "sending" | "ok" | "error">("idle");
  const [hint, setHint] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setHint(null);
    try {
      const r = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, message, priority }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || j?.error || "Αποτυχία αποστολής");
      setStatus("ok");
      setHint("Το αίτημα καταγράφηκε. Αν χρειάζεστε άμεση επικοινωνία, πατήστε εδώ: ");
      if (j?.mailto) {
        const a = document.createElement("a");
        a.href = j.mailto;
        a.textContent = "Άνοιγμα email";
        a.className = "underline";
        const wrap = document.getElementById("mailto-anchor");
        if (wrap) {
          wrap.innerHTML = "";
          wrap.appendChild(a);
        }
      }
      setSubject("");
      setMessage("");
      setPriority("normal");
    } catch (err: any) {
      setStatus("error");
      setHint(err?.message || "Κάτι πήγε στραβά");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Υποστήριξη</h1>
        <p className="text-sm text-gray-500">Στείλτε μας ένα αίτημα ή χρησιμοποιήστε τα στοιχεία επικοινωνίας.</p>
      </header>

      {/* New Ticket */}
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4">
        <h2 className="font-semibold mb-3">Νέο αίτημα</h2>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Θέμα</label>
            <input
              className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.currentTarget.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Περιγραφή</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm min-h-[120px]"
              value={message}
              onChange={(e) => setMessage(e.currentTarget.value)}
              required
            />
          </div>

          {/* Responsive controls: 2 rows on mobile, 1 row on ≥sm */}
          <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
            {/* Left block: priority */}
            <div className="flex items-center gap-3">
              <label className="text-sm">Προτεραιότητα:</label>
              <select
                className="rounded-lg border border-gray-300 bg-white p-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.currentTarget.value as any)}
              >
                <option value="low">Χαμηλή</option>
                <option value="normal">Κανονική</option>
                <option value="high">Υψηλή</option>
              </select>
            </div>

            {/* Right block: actions (full width on mobile, right-aligned on desktop) */}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setSubject("");
                  setMessage("");
                  setPriority("normal");
                  setStatus("idle");
                  setHint(null);
                }}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm bg-white hover:bg-gray-50"
              >
                Καθαρισμός
              </button>

              {/* Primary submit with visible text on any theme */}
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-xl px-4 py-2 text-sm font-semibold
                           bg-[color:var(--primary,#25C3F4)] text-black
                           hover:opacity-90 disabled:opacity-60"
              >
                {status === "sending" ? "Αποστολή…" : "Υποβολή"}
              </button>
            </div>
          </div>

          {status !== "idle" && (
            <div className={`text-sm ${status === "ok" ? "text-green-700" : "text-red-600"}`}>
              {hint} <span id="mailto-anchor" />
            </div>
          )}
        </form>
      </section>

      {/* Contact */}
      <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-4">
        <h2 className="font-semibold mb-3">Επικοινωνία</h2>
        <p className="text-sm">
          Τηλέφωνο: <a className="underline" href="tel:+302100000000">+30 210 000 0000</a><br />
          Email: <a className="underline" href="mailto:support@hygiene-plus.gr">support@hygiene-plus.gr</a>
        </p>
      </section>
    </div>
  );
}
