// src/app/page.tsx
export const runtime = "nodejs"; // ensure NextAuth runs on Node

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const me = await currentUser(); // null if not logged in

  if (!me) {
    redirect("/login");
  }

  redirect(me.role === "ADMIN" ? "/admin" : "/dashboard");
}
