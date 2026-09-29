import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { deleteSlots, makeSlot } from '@/test/slots';
import { STEPS } from '@/lib/validation/booking';
import {
  createDraft,
  firstIncompleteStep,
  getBookingByToken,
  hashToken,
  saveStep,
  submitIntake,
} from '@/server/services/booking';

const email = `integration-${Date.now()}@example.com`;

describe('booking service (integration, real Postgres)', () => {
  const slotIds: string[] = [];

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { email } });
    await deleteSlots(slotIds);
    await prisma.$disconnect();
  });

  it('runs the whole intake in order and only ever stores a hash of the token', async () => {
    const { token } = await createDraft(
      { fullName: 'Test Seller', email, phone: '0821234567' },
      { utmSource: 'facebook', utmContent: 'ad3', variant: 'price' },
    );

    const row = await prisma.booking.findFirstOrThrow({ where: { email } });
    expect(row.draftToken).toBe(hashToken(token));
    expect(row.draftToken).not.toBe(token);
    expect(row).toMatchObject({ utmSource: 'facebook', utmContent: 'ad3', landingPageVariantSlug: 'price' });
    expect(row.consentGivenAt).not.toBeNull();

    // The server, not the browser, decides what comes next — and refuses to submit early.
    let booking = await getBookingByToken(token);
    expect(firstIncompleteStep(booking, STEPS)).toBe('property');
    await expect(submitIntake(token, STEPS)).rejects.toThrow(/property/);

    await saveStep(token, 'property', { propertyAddress: '1 Main Rd, Cape Town', propertyType: 'House' });
    await saveStep(token, 'stage', { stage: 'HAVE_OTP' });
    await saveStep(token, 'ownership', { ownershipStructure: 'JOINT' });
    await saveStep(token, 'parties', { otherParties: 'Spouse (co-owner)' });
    await saveStep(token, 'details', { transactionSummary: 'Buyer offered R2m', mainConcern: 'Suspensive conditions' });
    await saveStep(token, 'intent', { desiredOutcome: 'Sell without penalty' });

    // Scheduling comes after the intake questions: language + a time from the live calendar.
    const slot = await makeSlot();
    slotIds.push(slot.id);
    booking = await getBookingByToken(token);
    expect(firstIncompleteStep(booking, STEPS)).toBe('schedule');
    await saveStep(token, 'schedule', { sessionLanguage: 'AFRIKAANS', slotId: slot.id });

    booking = await getBookingByToken(token);
    expect(firstIncompleteStep(booking, STEPS)).toBe('review');

    const submitted = await submitIntake(token, STEPS);
    expect(submitted.intakeSubmittedAt).not.toBeNull();
    expect(submitted.paymentStatus).toBe('PENDING');
    expect(submitted.sessionLanguage).toBe('AFRIKAANS');
    const held = await prisma.timeSlot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(held).toMatchObject({ status: 'BOOKED', bookingId: submitted.id });

    // Once submitted the intake is locked.
    await expect(saveStep(token, 'stage', { stage: 'CONSIDERING' })).rejects.toThrow(/already been submitted/);
  });

  it('ignores attempts to set payment fields through a step', async () => {
    const { token } = await createDraft({ fullName: 'Sneaky', email, phone: '0821234567' }, {});
    await saveStep(token, 'intent', {
      desiredOutcome: 'x',
      paymentStatus: 'PAID',
      amount: '0',
    });
    const b = await getBookingByToken(token);
    expect(b?.paymentStatus).toBe('PENDING');
    expect(Number(b?.amount)).toBe(1250);
  });
});
