// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  // allow preview, root, all API routes (NextAuth/session), Next internals & assets
  const allow =
    p === "/preview" ||
    p === "/" ||
    p.startsWith("/api/") ||            // ✅ don't interfere with NextAuth/session
    p.startsWith("/_next/") ||
    p === "/favicon.ico" ||
    p.startsWith("/assets/") ||
    p.startsWith("/public/");

  if (allow) return NextResponse.next();

  // safety: if already on /preview (with a trailing slash), don't redirect again
  if (p.startsWith("/preview")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/preview";
  return NextResponse.redirect(url);
}

// simple matcher; we whitelist inside the function
export const config = {
  matcher: ["/:path*"],
};
