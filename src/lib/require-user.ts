// src/lib/require-user.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function requireUser() {
  const session = await getServerSession(authOptions);

  const user = session?.user as any;
  if (!user?.email) {
    return { ok: false as const, status: 401, user: null };
  }

  return {
    ok: true as const,
    status: 200,
    user: {
      id: user.id as string | undefined,
      email: user.email as string,
      role: user.role as "USER" | "ADMIN" | undefined,
    },
  };
}
