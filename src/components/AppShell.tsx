// src/components/AppShell.tsx
"use client";

import React from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const role = ((data?.user as any)?.role ?? "USER") as "ADMIN" | "USER";
  const name = data?.user?.name ?? null;

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg,#F6FAFC)] text-[var(--app-fg,#0A0F2C)]">
      <div className="flex min-h-screen">
        <div className="hidden md:block md:sticky md:top-0 md:h-screen">
          <Sidebar role={role} name={name} />
        </div>

        {/* Smaller side padding; allow horizontal scroll for wide tables */}
        <main className="app-main flex-1 min-w-0 px-3 md:px-4 py-4 md:py-5 overflow-x-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
