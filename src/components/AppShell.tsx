// src/components/AppShell.tsx
import React from "react";
import Sidebar from "@/components/Sidebar";
import { currentUser } from "@/lib/auth-helpers";

type Role = "ADMIN" | "USER";

export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side: fetch the current user once so Sidebar knows the role.
  const user = await currentUser();
  const role: Role = (user?.role as Role) || "USER";
  const name = user?.name ?? null;

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="bg-[#0D2435] text-white">
        <Sidebar role={role} name={name} />
      </aside>
      <main className="bg-[#F9FAFB] p-6">{children}</main>
    </div>
  );
}
