"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ResetPasswordClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => sp.get("token") || "", [sp]);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!token) {
      setStatus("error");
      setMsg("Λείπει το token. Ανοίξτε ξανά το link από το email.");
      return;
    }
    if (password.length < 6) {
      setStatus("error");
      setMsg("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.");
      return;
    }
    if (password !== password2) {
      setStatus("error");
      setMsg("Οι κωδικοί δεν ταιριάζουν.");
      return;
    }

    setStatus("saving");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Αποτυχία αλλαγής κωδικού");

      setStatus("ok");
      setMsg("Ο κωδικός άλλαξε επιτυχώς. Μεταφορά στη σελίδα σύνδεσης…");
      setTimeout(() => router.push("/login"), 900);
    } catch (err: any) {
      setStatus("error");
      setMsg(err?.message || "Κάτι πήγε στραβά");
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] shadow-sm p-5">
        <h1 className="text-xl font-semibold mb-1">Αλλαγή κωδικού</h1>
        <p className="text-sm text-[color:var(--muted)] mb-4">
          Ορίστε νέο κωδικό για τον λογαριασμό σας.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-sm">Νέος κωδικός</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-white p-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm">Επιβεβαίωση κωδικού</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-white p-2 text-sm"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          {msg && (
            <p className={`text-sm ${status === "ok" ? "text-green-700" : "text-red-600"}`}>
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "saving"}
            className="w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
          >
            {status === "saving" ? "Αποθήκευση…" : "Αλλαγή κωδικού"}
          </button>
        </form>
      </div>
    </div>
  );
}
