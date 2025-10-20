// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth-helpers";



export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // if currentUser hits DB/session on the server

export default async function DashboardIndex() {
  const me = await currentUser();
  if (!me) {
    redirect("/login?next=/dashboard");
  }

  if (me.role === "ADMIN") {
    redirect("/admin");
  }

  // Adjust if your user home is different
  redirect("/dashboard/user");
}
