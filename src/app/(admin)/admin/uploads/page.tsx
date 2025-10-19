// src/app/(admin)/uploads/page.tsx
import React from "react";
import { cookies } from "next/headers";
import UploadForm from "@/components/UploadForm";
import FilesTable from "@/components/FilesTable";

export const dynamic = "force-dynamic";

async function fetchAdminFiles() {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const cookie = cookies().toString();

  const res = await fetch(`${base}/api/files?scope=all`, {
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

export default async function AdminUploadsPage() {
  const files = await fetchAdminFiles();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Uploads</h1>
          <p className="text-sm text-gray-500">Upload Excel files and manage all users’ files.</p>
        </div>
      </header>

      {/* Client upload form */}
      <UploadForm
        buttonText="Upload Excel"
        onUploaded={() => {
          // No-op here; table refresh is handled by manual reload or you can enhance with SWR.
          // Keeping this simple and drop-in friendly.
        }}
      />

      {/* Files table (admin mode shows assignees) */}
      <FilesTable initialFiles={files} adminMode />
    </div>
  );
}
