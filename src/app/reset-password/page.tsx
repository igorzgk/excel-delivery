// src/app/reset-password/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => sp.get("token") || "", [sp]);

  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMsg(null);

    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const m =
          j?.error === "expired_token"
            ? "Το link έληξε. Ζητήστε νέο."
            : j?.error === "invalid_token"
            ? "Μη έγκυρο link. Ζητήστε νέο."
            : "Αποτυχία αλλαγής κωδικού";
        throw new Error(m);
      }

      setStatus("ok");
      setMsg("Ο κωδικός άλλαξε! Μεταφορά στη σύνδεση…");
      setTimeout(() => router.push("/login"), 800);
    } catch (err: any) {
      setStatus("error");
      setMsg(err?.message || "Κάτι πήγε στραβά");
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md p-6">
        <p className="text-sm text-red-600">Λείπει το token επαναφοράς.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Ορισμός νέου κωδικού</h1>

      <form onSubmit={submit} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card,#fff)] p-4 space-y-3">
        <label className="block">
          <span className="text-sm">Νέος κωδικός</span>
          <input
            type="password"
            className="w-full border rounded p-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        <button
          type="submit"
          disabled={status === "saving"}
          className="w-full rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: "var(--brand,#25C3F4)", color: "#061630" }}
        >
          {status === "saving" ? "Αποθήκευση…" : "Αλλαγή κωδικού"}
        </button>

        {msg && (
          <div className={`text-sm ${status === "error" ? "text-red-600" : "text-green-700"}`}>
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}
