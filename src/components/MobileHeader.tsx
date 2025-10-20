// src/components/MobileHeader.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

type Role = "ADMIN" | "USER";

export default function MobileHeader({
  role,
  name,
}: {
  role: Role;
  name?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close when route changes
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close with ESC
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  return (
    <>
      {/* Top bar (mobile only) */}
      <div
        className="md:hidden sticky top-0 z-40 border-b"
        style={{ background: "#061630", borderColor: "rgba(255,255,255,.08)" }}
      >
        <div className="flex items-center gap-3 px-3 py-2">
          {/* Logo full-width on the left */}
          <div className="relative h-9 flex-1 overflow-hidden">
            <Image src="/logo.png" alt="HygienePlus" fill className="object-contain" priority />
          </div>

          {/* Hamburger on the right */}
          <button
            aria-label="Άνοιγμα μενού"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border active:scale-[0.98]"
            style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.15)", color: "#ECF5F8" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-50 bg-black/40 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer with your existing Sidebar */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "#061630" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-screen overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor: "rgba(255,255,255,.08)" }}>
            <div className="text-sm font-semibold" style={{ color: "#ECF5F8" }}>
              {name || (role === "ADMIN" ? "Διαχειριστής" : "Χρήστης")}
            </div>
            <button
              aria-label="Κλείσιμο μενού"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border active:scale-[0.98]"
              style={{ background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.15)", color: "#ECF5F8" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Sidebar role={role} name={name ?? undefined} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      </aside>
    </>
  );
}
