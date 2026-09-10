import type { Instrumentation } from 'next';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getEnv } = await import('@/lib/env');
    // Throws with a readable message if required configuration is missing or invalid,
    // so the server fails to start rather than serving with broken/insecure defaults.
    getEnv();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { logger } = await import('@/lib/logging/logger');
  const message = error instanceof Error ? error.message : String(error);
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String((error as { digest: unknown }).digest)
      : undefined;

  logger.error('Unhandled server error', {
    message,
    digest,
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
