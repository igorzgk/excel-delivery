"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { getMenu } from "@/lib/menu";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const role = (data?.user as any)?.role ?? "USER";
  const name = data?.user?.name ?? "User";

  const items = useMemo(() => getMenu(role), [role]);
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen w-full flex">
      <Sidebar items={items} userName={name} open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 min-w-0">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
