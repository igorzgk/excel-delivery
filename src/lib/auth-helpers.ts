import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function currentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null; // has .role and .id
}

export async function requireRole(role: "ADMIN" | "USER") {
  const user = await currentUser();
  if (!user) return { ok: false as const, status: 401 as const };
  if (role === "ADMIN" && (user as any).role !== "ADMIN")
    return { ok: false as const, status: 403 as const };
  return { ok: true as const, user };
}
