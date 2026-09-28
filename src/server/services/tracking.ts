import { prisma } from '@/lib/db/prisma';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { sendCapiEvent } from '@/lib/tracking/meta-capi';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
}

/**
 * Sends the Lead/Schedule TrackedEvent rows created for a booking to Meta's Conversions API.
 * Each row's own eventId matches what the client-side pixel fires, so Meta dedupes them.
 * Skips rows already sent, and never throws — a tracking failure must never affect the booking.
 */
export async function sendPendingCapiEvents(bookingId: string, ctx: RequestContext): Promise<void> {
  const env = getEnv();
  if (!env.META_PIXEL_ID || !env.META_CAPI_ACCESS_TOKEN) return; // tracking not configured — nothing to do

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;

  const pending = await prisma.trackedEvent.findMany({
    where: { bookingId, capiFiredAt: null, eventName: { in: ['LEAD', 'SCHEDULE'] } },
  });

  const sourceUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/book/confirmation`;

  for (const row of pending) {
    const result = await sendCapiEvent({
      eventName: row.eventName === 'LEAD' ? 'Lead' : 'Schedule',
      eventId: row.eventId,
      eventTime: row.createdAt,
      sourceUrl,
      userData: {
        email: booking.email ?? undefined,
        phone: booking.phone ?? undefined,
        clientIpAddress: ctx.ip,
        clientUserAgent: ctx.userAgent,
        fbc: ctx.fbc,
        fbp: ctx.fbp,
      },
    });

    await prisma.trackedEvent.update({
      where: { id: row.id },
      data: { capiFiredAt: new Date(), capiSuccess: result.success },
    });
    if (!result.success) {
      logger.warn('Meta CAPI event failed', { bookingId, eventName: row.eventName, error: result.error });
    }
  }
}
