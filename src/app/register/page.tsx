// src/app/register/page.tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "");
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        const zerr = (data?.error?.fieldErrors && Object.values(data.error.fieldErrors)[0]?.[0]) as string | undefined;
        setError(zerr || data?.error || "Η εγγραφή απέτυχε");
        setLoading(false);
        return;
      }

      setLoading(false);
      router.replace("/login?notice=pending");
    } catch {
      setError("Κάτι πήγε στραβά");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">Δημιουργία λογαριασμού</h1>
        <p className="text-sm text-gray-500 mb-6">Αποκτήστε πρόσβαση στον πίνακα ελέγχου μετά την εγγραφή.</p>

        {error && (
          <div className="mb-4 text-sm border rounded-md p-3 bg-red-50 border-red-200 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="name">Όνομα</label>
            <input id="name" name="name" required className="w-full rounded-md border p-2" />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="email">Ηλεκτρονικό ταχυδρομείο</label>
            <input id="email" name="email" type="email" required className="w-full rounded-md border p-2" />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="password">Κωδικός πρόσβασης</label>
            <input id="password" name="password" type="password" required className="w-full rounded-md border p-2" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black text-white py-2 disabled:opacity-60"
          >
            {loading ? "Δημιουργία..." : "Δημιουργία λογαριασμού"}
          </button>
        </form>

        <p className="text-sm mt-4">
          Έχετε ήδη λογαριασμό; <a className="underline" href="/login">Σύνδεση</a>
        </p>
      </div>
    </main>
  );
}
