/**
 * Prisma Client Singleton
 * ======================
 * Ensures a single PrismaClient instance is used across the application.
 * In development, this prevents too many connections due to hot reloading.
 *
 * Usage:
 *   import { db } from '@/lib/db';
 *   const companies = await db.company.findMany();
 */

import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// Export for backwards compatibility
export const prisma = db;
