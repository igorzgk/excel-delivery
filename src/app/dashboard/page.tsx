"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function Dashboard() {
  const { data, status } = useSession();
  if (status === "loading") return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {status === "authenticated" ? (
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="underline">
            Sign out
          </button>
        ) : (
          <Link href="/login" className="underline">Sign in</Link>
        )}
      </div>

      {status === "authenticated" ? (
        <>
          <p>You're logged in 🎉</p>
          {data?.user?.email && <p className="text-sm mt-2">Signed in as {data.user.email}</p>}
        </>
      ) : (
        <p>Please sign in to continue.</p>
      )}
    </main>
  );
}
