import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.fn();
vi.mock('@/lib/email/email', () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { prisma } from '@/lib/db/prisma';
import { STEPS } from '@/lib/validation/booking';
import { deleteSlots, makeSlot } from '@/test/slots';
import { addDocument, createDraft, saveStep, submitIntake } from '@/server/services/booking';
import { DOC_REMINDER_HOURS_BEFORE, sendDueDocumentReminders } from '@/server/services/reminders';

const email = `reminder-${Date.now()}@example.com`;
const slotIds: string[] = [];

/**
 * Books a session the normal way (which requires >= 24h notice, so the slot must start well in
 * the future to pass), then moves that already-booked slot's startsAt back to `hoursFromNow` —
 * simulating that the booking was made earlier and time has since passed to land inside (or
 * outside) the reminder window. This only rewrites a stored value directly; it doesn't touch
 * the 24h-notice rule itself, which stays fully in effect for real bookings.
 */
async function submittedBookingAt(hoursFromNow: number, name: string) {
  const { token } = await createDraft({ fullName: name, email, phone: '0821234567' }, {});
  await saveStep(token, 'property', { propertyAddress: '1 Main Rd', propertyType: 'House' });
  await saveStep(token, 'stage', { stage: 'CONSIDERING' });
  await saveStep(token, 'ownership', { ownershipStructure: 'PERSONAL' });
  await saveStep(token, 'parties', { otherParties: 'None' });
  await saveStep(token, 'details', { transactionSummary: 'S', mainConcern: 'C' });
  await saveStep(token, 'intent', { desiredOutcome: 'O' });

  const bookableSlot = await makeSlot(3, slotIds.length);
  slotIds.push(bookableSlot.id);
  await saveStep(token, 'schedule', { sessionLanguage: 'ENGLISH', slotId: bookableSlot.id });
  const booking = await submitIntake(token, STEPS);

  const startsAt = new Date(Date.now() + hoursFromNow * 3600_000);
  await prisma.timeSlot.update({
    where: { id: bookableSlot.id },
    data: { startsAt, endsAt: new Date(startsAt.getTime() + 3600_000) },
  });

  return { token, booking };
}

describe('sendDueDocumentReminders (integration, real Postgres)', () => {
  beforeEach(() => sendEmail.mockReset().mockResolvedValue(undefined));

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { email } });
    await deleteSlots(slotIds);
    await prisma.$disconnect();
  });

  it('reminds only bookings inside the window with no documents, not yet reminded', async () => {
    const dueNoDocuments = await submittedBookingAt(DOC_REMINDER_HOURS_BEFORE - 1, 'Due Soon');
    const dueWithDocuments = await submittedBookingAt(DOC_REMINDER_HOURS_BEFORE - 2, 'Already Uploaded');
    await addDocument(dueWithDocuments.token, {
      name: 'otp.pdf',
      bytes: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(32)]),
    });
    const tooFarOut = await submittedBookingAt(DOC_REMINDER_HOURS_BEFORE + 5, 'Not Yet');

    const { sent } = await sendDueDocumentReminders();
    expect(sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe(email);
    expect(sendEmail.mock.calls[0][0].text).toContain('Your Pre-Sale Property Strategy Session is on');
    expect(sendEmail.mock.calls[0][0].text).toContain('/book/upload');

    const [soon, withDocs, later] = await Promise.all(
      [dueNoDocuments, dueWithDocuments, tooFarOut].map((b) =>
        prisma.booking.findUniqueOrThrow({ where: { id: b.booking.id } }),
      ),
    );
    expect(soon.docReminderSentAt).not.toBeNull();
    expect(withDocs.docReminderSentAt).toBeNull(); // had documents — never due
    expect(later.docReminderSentAt).toBeNull(); // outside the window — not due yet
  });

  it('never reminds the same booking twice, even across overlapping runs', async () => {
    await submittedBookingAt(DOC_REMINDER_HOURS_BEFORE - 1, 'Once Only');

    const [a, b] = await Promise.all([sendDueDocumentReminders(), sendDueDocumentReminders()]);
    expect(a.sent + b.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // A third run afterwards must also skip it — the claim persists.
    const third = await sendDueDocumentReminders();
    expect(third.sent).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('leaves the booking retryable if sending fails', async () => {
    sendEmail.mockRejectedValueOnce(new Error('SMTP down'));
    const { booking } = await submittedBookingAt(DOC_REMINDER_HOURS_BEFORE - 1, 'Retry Me');

    expect((await sendDueDocumentReminders()).sent).toBe(0);
    let row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row.docReminderSentAt).toBeNull();

    expect((await sendDueDocumentReminders()).sent).toBe(1);
    row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row.docReminderSentAt).not.toBeNull();
  });
});
