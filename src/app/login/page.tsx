"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic"; // avoid static prerender for this page

function QueryEffect({ setError }: { setError: (msg: string) => void }) {
  const sp = useSearchParams();

  useEffect(() => {
    const authError = sp.get("error");
    const notice = sp.get("notice");
    if (authError === "AccountPending") setError("Your account is awaiting admin approval.");
    else if (authError === "AccountSuspended") setError("Your account is suspended. Contact support.");
    else if (notice === "pending") setError("Signup successful. Wait for admin approval before logging in.");
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
      if (res.error === "AccountPending")   return setError("Your account is awaiting admin approval.");
      if (res.error === "AccountSuspended") return setError("Your account is suspended. Contact support.");
      return setError("Wrong email or password");
    }
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      {/* Wrap the hook-driven side-effect inside Suspense */}
      <Suspense fallback={null}>
        <QueryEffect setError={setError} />
      </Suspense>

      <div className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="space-y-3 border rounded-2xl p-6 bg-white">
          <h1 className="text-xl font-semibold">Log in</h1>

          <label className="block">
            <span className="text-sm">Email</span>
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
            <span className="text-sm">Password</span>
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
            {loading ? "Logging in..." : "Log in"}
          </button>

          <p className="text-sm mt-2 text-center">
            New here? <a className="underline" href="/register">Create account</a>
          </p>
        </form>
      </div>
    </main>
  );
}
