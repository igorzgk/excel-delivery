"use client";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)]/60 bg-[color:var(--card)]/80 backdrop-blur">
      <div className="h-14 flex items-center gap-3 px-3">
        <button
          onClick={onMenu}
          className="md:hidden rounded-md border border-[color:var(--border)] px-3 py-2"
          aria-label="Open menu"
        >
          ☰
        </button>
        <div className="font-medium">Excel Delivery</div>
        <div className="ml-auto text-sm text-[color:var(--muted)]">v0.1</div>
      </div>
    </header>
  );
}
