// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const url = (p: string) => new URL(p, req.url);

  // Read JWT (needs NEXTAUTH_SECRET in .env)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

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

  // Not logged in → go to login
  if (needsAuth && !token) {
    const login = url("/login");
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  // Admin-only /admin area
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (token?.role !== "ADMIN") {
      return NextResponse.redirect(url("/dashboard"));
    }
  }

  // ✅ If ADMIN hits /dashboard, route to the admin dashboard
  if (pathname === "/dashboard" && token?.role === "ADMIN") {
    return NextResponse.redirect(url("/dashboard/admin"));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
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
