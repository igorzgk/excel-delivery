import React from "react";
import AdminPdfFolders from "@/components/AdminPdfFolders";

export const dynamic = "force-dynamic";

export default function AdminPdfFoldersPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Φάκελοι PDF (Admin)</h1>
        <p className="text-sm text-gray-500">Δημιουργία φακέλων PDF για χρήστες.</p>
      </header>

      <AdminPdfFolders />
    </div>
  );
}
