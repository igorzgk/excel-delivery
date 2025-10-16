// src/app/(admin)/layout.tsx
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { currentUser } from "@/lib/auth-helpers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login?next=/admin");
  }

  // AppShell will render the Sidebar and content area
  return <AppShell>{children}</AppShell>;
}
