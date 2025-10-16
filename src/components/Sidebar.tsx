// src/components/Sidebar.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { getMenu } from "@/lib/menu";

type Role = "ADMIN" | "USER";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

export default function Sidebar({
  role,
  name,
}: {
  role: Role;
  name?: string | null;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const items = getMenu(role);

  return (
    <aside
      className="hidden md:flex md:flex-col w-60 shrink-0 border-r"
      style={{
        backgroundColor: "var(--sidebar-bg)",
        color: "var(--sidebar-text)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--sidebar-muted)" }}>
          Συνδεδεμένος
        </div>
        <div className="font-medium">{name || (role === "ADMIN" ? "Διαχειριστής" : "Χρήστης")}</div>
      </div>

      <nav className="p-2 space-y-1">
        {items.map((i) => {
          const active = isActive(pathname, i.href);
          return (
            <button
              key={i.href}
              type="button"
              onClick={() => router.push(i.href)}
              className="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm"
              style={{
                backgroundColor: active ? "var(--sidebar-active-bg)" : "transparent",
                color: active ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
              }}
            >
              <span>{i.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto p-3 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-white/10"
          title="Αποσύνδεση"
        >
          Αποσύνδεση
        </button>
        <div className="mt-2 text-xs" style={{ color: "var(--sidebar-muted)" }}>
          v0.1
        </div>
      </div>
    </aside>
  );
}
