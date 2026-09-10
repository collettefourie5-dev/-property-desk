import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness probe: process is up and serving requests. No dependency checks. */
export function GET() {
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
