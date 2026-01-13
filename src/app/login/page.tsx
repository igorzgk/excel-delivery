// src/app/login/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function QueryEffect({ setError }: { setError: (msg: string) => void }) {
  const sp = useSearchParams();
  useEffect(() => {
    const authError = sp.get("error");
    const notice = sp.get("notice");
    if (authError === "AccountPending") setError("Ο λογαριασμός σας αναμένει έγκριση από διαχειριστή.");
    else if (authError === "AccountSuspended") setError("Ο λογαριασμός σας έχει ανασταλεί. Επικοινωνήστε με την υποστήριξη.");
    else if (notice === "pending") setError("Η εγγραφή ολοκληρώθηκε. Περιμένετε έγκριση από διαχειριστή.");
  }, [sp, setError]);
  return null;
}

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);
    if (res?.error) {
      if (res.error === "AccountPending")   return setError("Ο λογαριασμός σας αναμένει έγκριση από διαχειριστή.");
      if (res.error === "AccountSuspended") return setError("Ο λογαριασμός σας έχει ανασταλεί. Επικοινωνήστε με την υποστήριξη.");
      return setError("Λάθος email ή κωδικός");
    }
    // ✅ Let middleware route by role (Admin -> /admin, User -> /dashboard)
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Suspense fallback={null}>
        <QueryEffect setError={setError} />
      </Suspense>

      <div className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="space-y-3 border rounded-2xl p-6 bg-white">
          <h1 className="text-xl font-semibold">Σύνδεση</h1>

          <label className="block">
            <span className="text-sm">Ηλεκτρονικό ταχυδρομείο</span>
            <input
              className="w-full border rounded p-2"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              type="email"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="text-sm">Κωδικός πρόσβασης</span>
            <input
              className="w-full border rounded p-2"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              type="password"
              autoComplete="current-password"
            />
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            disabled={loading}
            className="w-full rounded bg-black text-white py-2 disabled:opacity-60"
          >
            {loading ? "Σύνδεση..." : "Σύνδεση"}
          </button>

          <p className="text-sm mt-2 text-center">
            Νέος χρήστης; <a className="underline" href="/register">Δημιουργία λογαριασμού</a>
          </p>
          <Link href="/forgot-password" className="text-sm underline">
            Ξέχασα τον κωδικό μου
          </Link>

        </form>
      </div>
    </main>
  );
}
