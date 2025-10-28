// src/components/Sidebar.tsx
"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { getMenu } from "@/lib/menu";

type Role = "ADMIN" | "USER";

/**
 * heightMode:
 *  - "screen" (default) -> Sidebar takes full viewport height (desktop)
 *  - "full"            -> Sidebar fills parent container height (mobile drawer)
 */
export default function Sidebar({
  role,
  name,
  onNavigate,
  heightMode = "screen",
}: {
  role: Role;
  name?: string | null;
  onNavigate?: () => void;
  heightMode?: "screen" | "full";
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const items = getMenu(role);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={`flex ${heightMode === "screen" ? "h-screen" : "h-full"} min-h-0 w-60 shrink-0 flex-col border-r`}
      style={{
        backgroundColor: "var(--sidebar-bg,#061630)",
        color: "var(--sidebar-text,#ECF5F8)",
        borderColor: "var(--sidebar-border,rgba(255,255,255,.08))",
      }}
    >
      {/* Top: logo + status */}
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

      {/* Nav (takes remaining height; scrolls if needed) */}
      <nav className="p-2 space-y-1 flex-1 min-h-0 overflow-auto">
        {items.map((i) => {
          const active = isActive(i.href);
          return (
            <button
              key={i.href}
              type="button"
              onClick={() => {
                router.push(i.href);
                onNavigate?.();
              }}
              className="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
              style={{
                backgroundColor: active ? "var(--sidebar-active-bg,rgba(37,195,244,.15))" : "transparent",
                color: active ? "var(--sidebar-active-text,#FFFFFF)" : "var(--sidebar-text,#ECF5F8)",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  e.currentTarget.style.backgroundColor = "var(--sidebar-hover-bg,rgba(255,255,255,.06))";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <span>{i.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom: logout + contact (always visible) */}
      <div
        className="p-4 border-t"
        style={{ borderColor: "var(--sidebar-border,rgba(255,255,255,.08))" }}
      >
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors"
          style={{
            color: "var(--sidebar-text,#ECF5F8)",
            backgroundColor: "rgba(255,255,255,.05)",
            border: "1px solid var(--sidebar-border,rgba(255,255,255,.12))",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,.05)")}
          onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px rgba(37,195,244,.35)")}
          onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
        >
          Αποσύνδεση
        </button>

        <div className="mt-3 text-[11px] leading-5" style={{ color: "var(--sidebar-muted,#A7BECC)" }}>
          <div className="font-semibold mb-1" style={{ color: "var(--sidebar-text,#ECF5F8)" }}>
            Επικοινωνία
          </div>
          <div>
            Τηλ: <a className="underline underline-offset-2" href="tel:+306942811202">+30 6942811202</a>
          </div>
          <div>
            Email:{" "}
            <a className="underline underline-offset-2" href="mailto:info@hplus.gr">
              info@hplus.gr
            </a>
          </div>
          <div className="mt-2">v0.1</div>
        </div>
      </div>
    </aside>
  );
}
