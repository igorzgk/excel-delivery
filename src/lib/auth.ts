// src/lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email & Password",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const creds = z.object({
          email: z.string().email(),
          password: z.string().min(6),
        }).parse(raw);

        //const user = await prisma.user.findUnique({ where: { email: creds.email } });
        //if (!user || !user.passwordHash) return null;

        //const ok = await bcrypt.compare(creds.password, user.passwordHash);
        //if (!ok) return null;

        //return { id: user.id, email: user.email, name: user.name ?? "", role: user.role };

        // ...
        const user = await prisma.user.findUnique({ where: { email: creds.email } });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(creds.password, user.passwordHash);
        if (!ok) return null;

        // 👇 block if not approved
        if (user.status !== 'ACTIVE') {
        // Option A: return null (generic error)
        // return null;

        // Option B: throw a custom error to show message on /login
        throw new Error(user.status === 'PENDING' ? 'AccountPending' : 'AccountSuspended');
        }

        return { id: user.id, email: user.email, name: user.name ?? "", role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).id = (user as any).id;
        (token as any).role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).id;
        (session.user as any).role = (token as any).role;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};
