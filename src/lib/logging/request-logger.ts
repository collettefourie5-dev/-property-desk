import 'server-only';
import { headers } from 'next/headers';
import { logger, type Logger } from '@/lib/logging/logger';

/** Builds a per-request logger carrying the correlation id set by proxy.ts, for use in Server Actions and Route Handlers. */
export async function getRequestLogger(context: { route?: string; userId?: string } = {}): Promise<Logger> {
  const headerList = await headers();
  const requestId = headerList.get('x-request-id') ?? crypto.randomUUID();
  return logger.child({ requestId, ...context });
}
