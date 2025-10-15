"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem } from "@/lib/menu";

export function Sidebar({
  items,
  userName,
  open,
  onClose,
}: {
  items: MenuItem[];
  userName?: string;
  open: boolean;              // mobile drawer state
  onClose: () => void;        // close drawer (mobile)
}) {
  const pathname = usePathname();
  const Nav = (
    <nav className="mt-4 space-y-1">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={onClose}
            className={[
              "block rounded-lg px-3 py-2 text-sm transition",
              active
                ? "bg-white/10 text-white"
                : "text-white/80 hover:text-white hover:bg-white/5",
            ].join(" ")}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );

  // Desktop
  return (
    <>
      <aside
        className="hidden md:flex md:flex-col w-64 shrink-0 h-screen sticky top-0
                   bg-[color:var(--nav)] text-white border-r border-black/10"
      >
        <div className="px-4 h-14 flex items-center font-semibold">Excel Delivery</div>
        <div className="px-4 text-xs uppercase tracking-wide text-white/60">Signed in</div>
        <div className="px-4 text-sm font-medium">{userName ?? "User"}</div>
        <div className="px-2">{Nav}</div>
        <div className="mt-auto p-4 text-xs text-white/60">
            <form action="/api/auth/signout" method="post">
                <button className="w-full rounded-md bg-white/10 px-3 py-2 hover:bg-white/20">
                Sign out
                </button>
            </form>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          aria-modal="true" role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="absolute top-0 left-0 h-full w-72 bg-[color:var(--nav)] text-white shadow-xl p-4">
            <div className="h-14 flex items-center justify-between">
              <div className="font-semibold">Excel Delivery</div>
              <button
                onClick={onClose}
                className="rounded-md px-3 py-1 bg-white/10 hover:bg-white/20"
              >
                Close
              </button>
            </div>
            <div className="text-xs uppercase tracking-wide text-white/60">Signed in</div>
            <div className="text-sm font-medium mb-2">{userName ?? "User"}</div>
            {Nav}
          </div>
        </div>
      )}
    </>
  );
}
