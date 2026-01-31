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
import { PrismaPg } from '@prisma/adapter-pg';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma v7 requires a driver adapter for PostgreSQL
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
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
