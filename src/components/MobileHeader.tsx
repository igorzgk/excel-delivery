"use client";

import Image from "next/image";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/Button";
import Sidebar from "@/components/Sidebar";

type Role = "ADMIN" | "USER";

export default function MobileHeader({
  role,
  name,
}: {
  role: Role;
  name?: string | null;
}) {
  return (
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
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="h-9 w-9 rounded-xl border"
              style={{
                background: "rgba(255,255,255,.06)",
                borderColor: "rgba(255,255,255,.15)",
                color: "#ECF5F8",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Button>
          </SheetTrigger>

          <SheetContent
            side="left"
            className="p-0 w-72 max-w-[85vw] border-0"
            style={{ background: "#061630", color: "#ECF5F8" }}
          >
            {/* reuse your existing Sidebar */}
            <div className="h-full overflow-y-auto">
              <Sidebar role={role} name={name ?? undefined} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
