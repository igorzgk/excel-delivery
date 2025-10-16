// src/app/(user)/layout.tsx
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { currentUser } from "@/lib/auth-helpers";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return <AppShell>{children}</AppShell>;
}
