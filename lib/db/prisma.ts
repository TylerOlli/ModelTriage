/**
 * Prisma Client Singleton
 *
 * In development, Next.js hot-reloads modules on every change, which
 * would create a new PrismaClient instance each time — eventually
 * exhausting the database connection pool. This singleton pattern
 * stores the client on `globalThis` so it survives hot reloads.
 *
 * In production, the module is only loaded once, so the global
 * assignment is a no-op safeguard.
 *
 * Usage:
 *   import { prisma } from "@/lib/db/prisma";
 *   await prisma.routingDecision.create({ data: { ... } });
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
