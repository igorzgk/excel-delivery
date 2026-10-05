import React from "react";
import { cookies } from "next/headers";
import PdfFoldersBoard from "@/components/PdfFoldersBoard";

export const dynamic = "force-dynamic";

async function fetchMyFiles() {
  const base =
    process.env.NEXTAUTH_URL || "https://hygiene-plus.vercel.app";

  const cookie = cookies().toString();

  const res = await fetch(`${base}/api/files`, {
    cache: "no-store",
    headers: { cookie },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Failed to load files (${res.status}): ${detail}`
    );
  }

  const data = await res.json();

  return data.files as any[];
}

export default async function DocumentationPage() {
  const files = await fetchMyFiles();

  return (
    <div className="mx-auto max-w-[1460px] space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Υπόλοιπα αρχεία τεκμηρίωσης
        </h1>

        <p className="text-sm text-gray-500">
          Φάκελοι και αρχεία PDF τεκμηρίωσης.
        </p>
      </header>

      <PdfFoldersBoard initialFiles={files} />
    </div>
  );
}