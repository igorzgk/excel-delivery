// src/app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMsg(null);

    try {
      const r = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Αποτυχία");

      setStatus("ok");
      setMsg("Αν υπάρχει λογαριασμός, θα λάβετε email με οδηγίες επαναφοράς.");
    } catch (err: any) {
      setStatus("error");
      setMsg(err?.message || "Κάτι πήγε στραβά");
    }
  }

  return (
    <div className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Επαναφορά κωδικού</h1>
      <p className="text-sm text-gray-600">
        Βάλτε το email σας και θα σας στείλουμε link για να ορίσετε νέο κωδικό.
      </p>

      <form onSubmit={submit} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4 space-y-3">
        <label className="block">
          <span className="text-sm">Email</span>
          <input
            type="email"
            className="w-full border rounded p-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
        >
          {status === "sending" ? "Αποστολή…" : "Στείλε μου link"}
        </button>

        {msg && (
          <div className={`text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}>
            {msg}
          </div>
        )}

        <div className="text-sm">
          <Link className="underline" href="/login">Επιστροφή στη σύνδεση</Link>
        </div>
      </form>
    </div>
  );
}
