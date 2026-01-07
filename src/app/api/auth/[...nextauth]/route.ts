// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";


export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password || "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        if (user.status === "PENDING")   throw new Error("AccountPending");
        if (user.status === "SUSPENDED") throw new Error("AccountSuspended");

        // Returned fields end up on `user` in the jwt callback
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // First login: copy over from `user`
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },

    async session({ session, token }) {
      // Expose id/role to the app
      (session.user as any).id = token.id;
      (session.user as any).role = token.role;
      return session;
    },

    // Normalize old /dashboard/admin links to /admin
    async redirect({ url, baseUrl }) {
      try {
        const u = new URL(url, baseUrl);
        if (u.pathname === "/dashboard/admin" || u.pathname.startsWith("/dashboard/admin/")) {
          u.pathname = u.pathname.replace("/dashboard/admin", "/admin");
          return u.toString();
        }
        return u.toString();
      } catch {
        if (url.startsWith("/dashboard/admin")) return "/admin";
        return url.startsWith("/") ? url : baseUrl;
      }
    },
  },

  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
