import { prisma } from '@/lib/db/prisma';
import { getEnv } from '@/lib/env';
import { sendEmail } from '@/lib/email/email';
import { documentReminderEmail } from '@/lib/email/templates/booking';
import { formatSlotFull } from '@/lib/time';
import { logger } from '@/lib/logging/logger';

/** Sent once, this many hours before the session, only if the client hasn't uploaded anything. */
export const DOC_REMINDER_HOURS_BEFORE = 12;

/**
 * Finds submitted bookings whose session starts within the next DOC_REMINDER_HOURS_BEFORE hours,
 * that have no documents and haven't already been reminded.
 */
export async function findDueDocumentReminders(now = new Date()) {
  const cutoff = new Date(now.getTime() + DOC_REMINDER_HOURS_BEFORE * 3600_000);
  return prisma.booking.findMany({
    where: {
      intakeSubmittedAt: { not: null },
      docReminderSentAt: null,
      documents: { none: {} },
      timeSlot: { startsAt: { gt: now, lte: cutoff } },
    },
    select: { id: true, fullName: true, email: true, timeSlot: { select: { startsAt: true } } },
  });
}

/**
 * Sends the due document-upload reminders. Each booking is claimed atomically (docReminderSentAt
 * null -> now) before sending, so two overlapping runs can't email the same client twice; a send
 * failure reverts the claim so the next run retries it. Never throws.
 */
export async function sendDueDocumentReminders(now = new Date()): Promise<{ sent: number }> {
  const env = getEnv();
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const due = await findDueDocumentReminders(now);

  let sent = 0;
  for (const booking of due) {
    if (!booking.email || !booking.timeSlot) continue;

    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, docReminderSentAt: null },
      data: { docReminderSentAt: now },
    });
    if (claimed.count === 0) continue; // another run already claimed it

    try {
      await sendEmail({
        to: booking.email,
        ...documentReminderEmail(booking, {
          sessionTime: formatSlotFull(booking.timeSlot.startsAt),
          uploadUrl: `${base}/book/upload`,
        }),
      });
      sent += 1;
    } catch (error) {
      await prisma.booking.update({ where: { id: booking.id }, data: { docReminderSentAt: null } });
      logger.error('Failed to send document reminder', {
        bookingId: booking.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { sent };
}
