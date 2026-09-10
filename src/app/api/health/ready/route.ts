import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logging/logger';

export const dynamic = 'force-dynamic';

/** Readiness probe: verifies required dependencies (Postgres) are reachable. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ready', checks: { database: 'ok' }, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logger.error('Readiness check failed: database unreachable', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { status: 'not_ready', checks: { database: 'error' }, timestamp: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
