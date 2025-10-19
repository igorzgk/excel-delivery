// src/app/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  // If middleware didn’t run for any reason, SSR-redirect based on session here.
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any)?.role;
  redirect(role === "ADMIN" ? "/dashboard/admin" : "/dashboard");
}
