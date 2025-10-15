// src/app/register/page.tsx
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '');
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Display first form error if present
        const zerr = (data?.error?.fieldErrors && Object.values(data.error.fieldErrors)[0]?.[0]) as string | undefined;
        setError(zerr || data?.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Auto-login after registration
      //const login = await signIn('credentials', {
      //redirect: false,
      //email,
      //password,
      //});

      // in src/app/register/page.tsx (after successful POST)
      setLoading(false);
      router.replace('/login?notice=pending'); // send them to login with a notice


      if (login?.error) {
        setError(login.error);
        setLoading(false);
        return;
      }

      router.replace('/dashboard');
    } catch (err) {
      setError('Something went wrong');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">Create account</h1>
        <p className="text-sm text-gray-500 mb-6">Access your dashboard after signing up.</p>

        {error && (
          <div className="mb-4 text-sm border rounded-md p-3 bg-red-50 border-red-200 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="name">Name</label>
            <input id="name" name="name" required className="w-full rounded-md border p-2" />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="w-full rounded-md border p-2" />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required className="w-full rounded-md border p-2" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black text-white py-2 disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>

        <p className="text-sm mt-4">
          Already have an account? <a className="underline" href="/login">Sign in</a>
        </p>
      </div>
    </main>
  );
}
