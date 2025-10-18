// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA: PrismaClient | undefined;
}

// recommended logging during debug:
// const log: any = ["error", "warn"];
const log: any = ["error"];

export const prisma =
  global.__PRISMA ??
  new PrismaClient({
    log,
    // Prisma 6 respects DATABASE_URL params (pgbouncer=true disables prepared statements).
  });

if (process.env.NODE_ENV !== "production") {
  global.__PRISMA = prisma;
}
