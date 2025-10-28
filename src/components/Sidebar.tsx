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
  onNavigate, // <-- NEW
}: {
  role: Role;
  name?: string | null;
  onNavigate?: () => void; // <-- NEW
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const items = getMenu(role);

  return (
    <aside
      className="flex h-screen w-60 shrink-0 flex-col border-r"
      style={{
        backgroundColor: "var(--sidebar-bg,#061630)",
        color: "var(--sidebar-text,#ECF5F8)",
        borderColor: "var(--sidebar-border,rgba(255,255,255,.08))",
      }}
    >
      {/* Top: full-width logo ABOVE the status */}
      <div
        className="px-4 pt-4 pb-3 border-b"
        style={{ borderColor: "var(--sidebar-border,rgba(255,255,255,.08))" }}
      >
        <div className="relative w-full h-12 overflow-hidden rounded-md bg-white/5 mb-2">
          <Image src="/logo.png" alt="Company logo" fill className="object-contain" priority />
        </div>
        <div className="leading-tight">
          <div className="text-[11px]" style={{ color: "var(--sidebar-muted,#A7BECC)" }}>
            Συνδεδεμένος — {name || (role === "ADMIN" ? "Διαχειριστής" : "Χρήστης")}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="p-2 space-y-1 overflow-auto">
        {items.map((i) => {
          const active = isActive(pathname, i.href);
          return (
            <button
              key={i.href}
              type="button"
              onClick={() => {
                router.push(i.href);
                onNavigate?.(); // <-- CLOSE DRAWER IF PROVIDED
              }}
              className="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: active ? "var(--sidebar-active-bg,rgba(37,195,244,.15))" : "transparent",
                color: active ? "var(--sidebar-active-text,#FFFFFF)" : "var(--sidebar-text,#ECF5F8)",
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget.style.backgroundColor = "var(--sidebar-hover-bg,rgba(255,255,255,.06))");
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
      <div className="mt-auto p-4 border-t" style={{ borderColor: "var(--sidebar-border,rgba(255,255,255,.08))" }}>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left rounded-md px-3 py-2 text-sm transition-colors"
          style={{ backgroundColor: "transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--sidebar-hover-bg,rgba(255,255,255,.06))")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          Αποσύνδεση
        </button>

        <div className="mt-3 text-[11px] leading-5" style={{ color: "var(--sidebar-muted,#A7BECC)" }}>
          <div className="font-semibold mb-1" style={{ color: "var(--sidebar-text,#ECF5F8)" }}>Επικοινωνία</div>
          <div>
            Τηλ: <a className="underline underline-offset-2" href="tel:+302100000000">+30 6942811202</a>
          </div>
          <div>
            Email: <a className="underline underline-offset-2" href="mailto:support@hygiene-plus.gr">info@hplus.gr</a>
            Email: <a className="underline underline-offset-2" href="mailto:support@hygiene-plus.gr">sp.chatzinikolaou@gmail.com</a>
          </div>
          <div className="mt-2">v0.1</div>
        </div>
      </div>
    </aside>
  );
}
