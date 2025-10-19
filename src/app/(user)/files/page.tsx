// src/app/(user)/files/page.tsx
import React from "react";
import { cookies } from "next/headers";
import FilesTable from "@/components/FilesTable";

export const dynamic = "force-dynamic";

async function fetchMyFiles() {
  const base = process.env.NEXTAUTH_URL || "https://hygiene-plus.vercel.app";
  const cookie = cookies().toString();

  const res = await fetch(`${base}/api/files`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to load files (${res.status}): ${detail}`);
  }
  const data = await res.json();
  return data.files as any[];
}

export default async function UserFilesPage() {
  const files = await fetchMyFiles();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Τα Αρχεία μου</h1>
        <p className="text-sm text-gray-500">Αρχεία που ανεβάσατε ή σας ανατέθηκαν.</p>
      </header>

      <FilesTable
        initialFiles={files}
        labels={{
          search: "Αναζήτηση αρχείων…",
          countSuffix: "αρχείο(α)",
          title: "Τίτλος",
          original: "Αρχικό",
          uploaded: "Ανέβηκε",
          size: "Μέγεθος",
          action: "Ενέργεια",
          download: "Λήψη",
          empty: "Δεν βρέθηκαν αρχεία.",
        }}
      />
    </div>
  );
}
