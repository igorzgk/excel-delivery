"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);
    if (res?.error) { setError("Wrong email or password"); return; }
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 border rounded-2xl p-6">
        <h1 className="text-xl font-semibold">Log in</h1>
        <label className="block">
          <span>Email</span>
          <input className="w-full border rounded p-2" value={email} onChange={e=>setEmail(e.target.value)} required type="email"/>
        </label>
        <label className="block">
          <span>Password</span>
          <input className="w-full border rounded p-2" value={password} onChange={e=>setPassword(e.target.value)} required type="password"/>
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={loading} className="w-full rounded bg-black text-white py-2">
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </main>
  );
}
