// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // safe default if currentUser touches Prisma/session server-side

export default async function DashboardIndex() {
  const me = await currentUser(); // should return null or { role: "ADMIN" | "USER", ... }
  if (!me) redirect("/login?next=/dashboard");

  if (me.role === "ADMIN") {
    redirect("/dashboard/admin");
  }

  // Default for regular users — adjust if your user dashboard path differs
  redirect("/dashboard/user");
}
