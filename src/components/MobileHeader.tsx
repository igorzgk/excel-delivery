"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

type Role = "ADMIN" | "USER";

export default function MobileHeader({
  role,
  name,
  brand = "Hygiene+",
}: {
  role: Role;
  name?: string | null;
  brand?: string;
}) {
  const [open, setOpen] = useState(false);

  // Close on ESC or route hash change (simple safety)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onHash = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  return (
    <>
      {/* Top bar — visible only on mobile */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="flex items-center gap-3 px-3 py-2">
          <button
            aria-label="Άνοιγμα μενού"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-white active:scale-[0.98]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="text-base font-semibold">{brand}</div>
        </div>
      </div>

      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-50 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer with your existing Sidebar inside */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform bg-[var(--sidebar-bg,#061630)] transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* We render Sidebar directly (no md:hidden here) */}
        <div className="h-screen overflow-hidden flex flex-col">
          {/* Close row */}
          <div
            className="flex items-center justify-between px-3 py-3 border-b"
            style={{ borderColor: "var(--sidebar-border,rgba(255,255,255,.08))" }}
          >
            <div className="text-sm font-semibold" style={{ color: "var(--sidebar-text,#ECF5F8)" }}>
              {name || (role === "ADMIN" ? "Διαχειριστής" : "Χρήστης")}
            </div>
            <button
              aria-label="Κλείσιμο μενού"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-white/10 active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Sidebar body scrolls independently */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Sidebar role={role} name={name ?? undefined} />
          </div>
        </div>
      </aside>
    </>
  );
}
