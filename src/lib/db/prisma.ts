import 'server-only';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getEnv } from '@/lib/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  // Reuse a single client across dev hot-reloads so we don't exhaust Postgres connections.
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Lazily instantiated so importing this module (e.g. during `next build`'s route
 * analysis, which only imports route modules without invoking handlers) never requires
 * DATABASE_URL to be set. The client is only actually constructed on first real query.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient() as object, prop, receiver);
  },
});
