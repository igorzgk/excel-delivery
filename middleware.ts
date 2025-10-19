// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Routing rules:
 * - "/" (root):
 *    - no token  -> /login
 *    - ADMIN     -> /dashboard/admin
 *    - USER/etc  -> /dashboard
 * - "/login":
 *    - already logged in -> role dashboard
 * - Protected areas (dashboard, files, assignments, support, admin)
 *    - no token -> /login?callbackUrl=<original>
 * - "/admin" area:
 *    - non-admin -> /dashboard
 * - "/dashboard" for admins -> redirect to /dashboard/admin
 */

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const url = (p: string) => new URL(p, req.url);
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // 1) Root: smart gateway
  if (pathname === "/") {
    if (!token) {
      return NextResponse.redirect(url("/login"));
    }
    // Logged in: route by role
    if (token.role === "ADMIN") {
      return NextResponse.redirect(url("/dashboard/admin"));
    }
    return NextResponse.redirect(url("/dashboard"));
  }

  // 2) Hitting /login while already authed? Send to dashboard by role
  if (pathname === "/login" && token) {
    if (token.role === "ADMIN") {
      return NextResponse.redirect(url("/dashboard/admin"));
    }
    return NextResponse.redirect(url("/dashboard"));
  }

  // 3) Which paths need auth?
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

  // 4) Not logged in -> go to /login with callbackUrl
  if (needsAuth && !token) {
    const login = url("/login");
    login.searchParams.set("callbackUrl", pathname + (search || ""));
    return NextResponse.redirect(login);
  }

  // 5) Admin-only gate for /admin
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && token?.role !== "ADMIN") {
    return NextResponse.redirect(url("/dashboard"));
  }

  // 6) Admins landing on /dashboard -> send to /dashboard/admin
  if (pathname === "/dashboard" && token?.role === "ADMIN") {
    return NextResponse.redirect(url("/dashboard/admin"));
  }

  return NextResponse.next();
}

export const config = {
  // Include root ("/") and login in the matcher so we can gateway at the edge
  matcher: [
    "/",                 // 👈 root gateway
    "/login",            // 👈 redirect logged-in users away from login
    "/dashboard",
    "/dashboard/:path*",
    "/files",
    "/files/:path*",
    "/assignments",
    "/assignments/:path*",
    "/support",
    "/support/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
