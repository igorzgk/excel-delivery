// middleware.ts (must be at repo root, next to package.json)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Global middleware with safe matcher:
 * - Matches all paths except Next assets and files with extensions.
 * - Handles "/" and "/login" routing, plus protected areas.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const url = (p: string) => new URL(p, req.url);
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Root gateway
  if (pathname === "/") {
    if (!token) return NextResponse.redirect(url("/login"));
    return NextResponse.redirect(url(token.role === "ADMIN" ? "/dashboard/admin" : "/dashboard"));
  }

  // Logged-in users should not see /login
  if (pathname === "/login" && token) {
    return NextResponse.redirect(url(token.role === "ADMIN" ? "/dashboard/admin" : "/dashboard"));
  }

  // Paths that need auth
  const needsAuth =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/files" ||
    pathname.startsWith("/files/") ||
    pathname === "/assignments" ||
    pathname.startsWith("/assignments/") ||
    pathname === "/support" ||
    pathname.startsWith("/support/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (needsAuth && !token) {
    const login = url("/login");
    login.searchParams.set("callbackUrl", pathname + (search || ""));
    return NextResponse.redirect(login);
  }

  // Non-admins cannot access /admin
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && token?.role !== "ADMIN") {
    return NextResponse.redirect(url("/dashboard"));
  }

  // Admins visiting /dashboard go to /dashboard/admin
  if (pathname === "/dashboard" && token?.role === "ADMIN") {
    return NextResponse.redirect(url("/dashboard/admin"));
  }

  return NextResponse.next();
}

// Match everything except _next assets and files with an extension (e.g., .png, .css, .ico)
export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
