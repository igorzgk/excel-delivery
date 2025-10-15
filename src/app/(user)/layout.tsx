import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/dashboard");
  if ((session.user as any).role === "ADMIN") redirect("/admin"); // keep admins out
  return <AppShell>{children}</AppShell>;
}
