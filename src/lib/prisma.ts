// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
}

/**
 * Use a single PrismaClient across hot reloads in dev
 * and a new one per serverless worker in production.
 */
export const prisma =
  global.__PRISMA__ ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__PRISMA__ = prisma;
}
