import type { Instrumentation } from 'next';

const REMINDER_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getEnv } = await import('@/lib/env');
    // Throws with a readable message if required configuration is missing or invalid,
    // so the server fails to start rather than serving with broken/insecure defaults.
    getEnv();

    // This app runs as a single always-on process on one Docker VM (spec: no queues/Redis
    // unless there's a genuine need), so an in-process interval is the simplest correct way to
    // run the periodic document-reminder check — no external cron or extra service required.
    // sendDueDocumentReminders() claims each booking atomically before sending, so it's safe even
    // if this ever runs from more than one instance.
    const { logger } = await import('@/lib/logging/logger');
    const { sendDueDocumentReminders } = await import('@/server/services/reminders');
    const runReminders = () =>
      sendDueDocumentReminders().catch((error: unknown) =>
        logger.error('Document reminder sweep failed', {
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    runReminders();
    setInterval(runReminders, REMINDER_CHECK_INTERVAL_MS).unref();
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
