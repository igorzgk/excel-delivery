// src/components/Sidebar.tsx
"use client";

import Image from "next/image";
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
      {/* Top: company logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="relative h-8 w-8 overflow-hidden rounded-md bg-white/5">
          {/* place a 64x64 (or similar) PNG in /public/logo.png */}
          <Image src="/logo.png" alt="Company logo" fill className="object-contain p-1" priority />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Hygiene&nbsp;Plus</div>
          <div className="text-[11px]" style={{ color: "var(--sidebar-muted)" }}>
            Συνδεδεμένος — {name || (role === "ADMIN" ? "Διαχειριστής" : "Χρήστης")}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="p-2 space-y-1">
        {items.map((i) => {
          const active = isActive(pathname, i.href);
          return (
            <button
              key={i.href}
              type="button"
              onClick={() => router.push(i.href)}
              className="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: active ? "var(--sidebar-active-bg)" : "transparent",
                color: active ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
              }}
              // hover color via CSS var (set in globals.css)
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget.style.backgroundColor = "var(--sidebar-hover-bg)");
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget.style.backgroundColor = "transparent");
              }}
            >
              <span>{i.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom: sign out + contact block */}
      <div className="mt-auto p-4 border-t space-y-3" style={{ borderColor: "var(--sidebar-border)" }}>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left rounded-md px-3 py-2 text-sm transition-colors"
          style={{ backgroundColor: "transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sidebar-hover-bg)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          Αποσύνδεση
        </button>

        {/* Contact info */}
        <div className="text-[11px] leading-5" style={{ color: "var(--sidebar-muted)" }}>
          <div className="font-semibold mb-1" style={{ color: "var(--sidebar-text)" }}>Επικοινωνία</div>
          <div>
            Τηλ: <a className="underline underline-offset-2" href="tel:+302100000000">+30 210 000 0000</a>
          </div>
          <div>
            Email: <a className="underline underline-offset-2" href="mailto:support@hygiene-plus.gr">support@hygiene-plus.gr</a>
          </div>
          <div className="mt-2">v0.1</div>
        </div>
      </div>
    </aside>
  );
}
