import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.ADMIN_NOTIFICATION_EMAIL = 'attorney@test.example';

const sendEmail = vi.fn();
vi.mock('@/lib/email/email', () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { prisma } from '@/lib/db/prisma';
import { STEPS } from '@/lib/validation/booking';
import { createDraft, saveStep, submitIntake } from '@/server/services/booking';
import { notifyNewBooking } from '@/server/services/notifications';

const email = `notify-${Date.now()}@example.com`;

async function submittedBooking() {
  const { token } = await createDraft({ fullName: 'Notify Tester', email, phone: '0821234567' }, { utmSource: 'facebook' });
  await saveStep(token, 'property', { propertyAddress: '1 Main Rd', propertyType: 'House' });
  await saveStep(token, 'stage', { stage: 'NEGOTIATING' });
  await saveStep(token, 'ownership', { ownershipStructure: 'PERSONAL' });
  await saveStep(token, 'parties', { otherParties: 'None' });
  await saveStep(token, 'details', { transactionSummary: 'Summary', mainConcern: 'Concern' });
  await saveStep(token, 'intent', { desiredOutcome: 'Outcome' });
  return submitIntake(token, STEPS);
}

describe('notifyNewBooking (integration, real Postgres)', () => {
  beforeEach(() => sendEmail.mockReset().mockResolvedValue(undefined));

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('emails the attorney (reply-to the client) and the client, and records it', async () => {
    const booking = await submittedBooking();
    expect(await notifyNewBooking(booking.id)).toBe(true);

    const [adminMail, clientMail] = sendEmail.mock.calls.map((c) => c[0]);
    expect(adminMail).toMatchObject({ to: 'attorney@test.example', replyTo: email });
    expect(adminMail.subject).toBe('New booking request — Notify Tester');
    expect(adminMail.text).toContain('facebook');
    expect(clientMail.to).toBe(email);

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row.adminNotifiedAt).not.toBeNull();
  });

  it('never sends twice for the same booking, even if called concurrently', async () => {
    const booking = await submittedBooking();
    const results = await Promise.all([notifyNewBooking(booking.id), notifyNewBooking(booking.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(sendEmail.mock.calls.filter((c) => c[0].to === 'attorney@test.example')).toHaveLength(1);
  });

  it('keeps the booking and leaves it flagged as not-sent when email delivery fails', async () => {
    sendEmail.mockRejectedValue(new Error('SMTP down'));
    const booking = await submittedBooking();

    expect(await notifyNewBooking(booking.id)).toBe(false);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row.adminNotifiedAt).toBeNull();
    expect(row.intakeSubmittedAt).not.toBeNull();

    // ...and a later resend goes through.
    sendEmail.mockResolvedValue(undefined);
    expect(await notifyNewBooking(booking.id, { force: true })).toBe(true);
  });

  it('does not notify for an unsubmitted draft', async () => {
    const { token } = await createDraft({ fullName: 'Draft Only', email, phone: '0821234567' }, {});
    const draft = await prisma.booking.findFirstOrThrow({ where: { fullName: 'Draft Only', email } });
    expect(token).toBeTruthy();
    expect(await notifyNewBooking(draft.id)).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
