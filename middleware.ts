// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const url = (p: string) => new URL(p, req.url);
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // --- Canonicalize any legacy /dashboard/admin -> /admin (single hop) ---
  if (pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/")) {
    const dest = url(pathname.replace("/dashboard/admin", "/admin") || "/admin");
    return NextResponse.redirect(dest);
  }

  // --- Root gateway ---
  if (pathname === "/") {
    if (!token) return NextResponse.redirect(url("/login"));
    // Admins -> /admin, Users -> /dashboard
    return NextResponse.redirect(url(token?.role === "ADMIN" ? "/admin" : "/dashboard"));
  }

  // --- Logged-in users should not see /login ---
  if (pathname === "/login" && token) {
    return NextResponse.redirect(url(token?.role === "ADMIN" ? "/admin" : "/dashboard"));
  }

  // --- Auth gate for protected areas ---
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

  // --- Non-admins cannot access /admin ---
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && token?.role !== "ADMIN") {
    return NextResponse.redirect(url("/dashboard"));
  }

  // --- Admins landing on /dashboard go to /admin (one hop; no loop) ---
  if (pathname === "/dashboard" && token?.role === "ADMIN") {
    return NextResponse.redirect(url("/admin"));
  }

  return NextResponse.next();
}

// Match everything except Next assets and files with an extension
export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
