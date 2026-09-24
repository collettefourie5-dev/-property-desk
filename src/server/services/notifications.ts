import { prisma } from '@/lib/db/prisma';
import { getEnv } from '@/lib/env';
import { sendEmail } from '@/lib/email/email';
import { bookingRequestEmail, clientAcknowledgementEmail } from '@/lib/email/templates/booking';
import { logger } from '@/lib/logging/logger';
import { getSiteConfig } from '@/lib/site-config';

/**
 * Emails the attorney a new booking request (and the client a receipt).
 *
 * The booking is already safely in the database before this runs, so an email failure can never
 * lose a request — it just leaves `adminNotifiedAt` empty, which the admin list surfaces with a
 * "Resend" button. The claim below is atomic, so a double-submit or a retry can't send twice.
 * Never throws.
 */
export async function notifyNewBooking(bookingId: string, { force = false } = {}): Promise<boolean> {
  const env = getEnv();
  const to = env.ADMIN_NOTIFICATION_EMAIL;
  if (!to) {
    logger.warn('ADMIN_NOTIFICATION_EMAIL is not set — booking request was saved but not emailed', {
      bookingId,
    });
    return false;
  }

  // Claim: only the caller that flips adminNotifiedAt from null sends the email.
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, ...(force ? {} : { adminNotifiedAt: null }), intakeSubmittedAt: { not: null } },
    data: { adminNotifiedAt: new Date() },
  });
  if (claimed.count === 0) return false;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { documents: { orderBy: { uploadedAt: 'asc' } } },
  });
  if (!booking) return false;

  const site = getSiteConfig();
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');

  try {
    const admin = bookingRequestEmail(booking, { adminUrl: `${base}/admin/bookings/${booking.id}` });
    await sendEmail({ to, ...admin, replyTo: booking.email ?? undefined });
  } catch (error) {
    await prisma.booking.update({ where: { id: bookingId }, data: { adminNotifiedAt: null } });
    logger.error('Failed to email booking request to admin', {
      bookingId,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }

  if (booking.email && !force) {
    try {
      await sendEmail({
        to: booking.email,
        ...clientAcknowledgementEmail(booking, {
          attorneyName: site.attorneyName,
          whatToExpectUrl: `${base}/what-to-expect`,
        }),
      });
    } catch (error) {
      // The attorney has the request; a missing receipt is not worth failing over.
      logger.warn('Failed to send client acknowledgement', {
        bookingId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return true;
}
