import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.META_PIXEL_ID = 'pixel123';
process.env.META_CAPI_ACCESS_TOKEN = 'token123';

const sendCapiEvent = vi.fn();
vi.mock('@/lib/tracking/meta-capi', () => ({ sendCapiEvent: (...args: unknown[]) => sendCapiEvent(...args) }));

import { prisma } from '@/lib/db/prisma';
import { STEPS } from '@/lib/validation/booking';
import { deleteSlots, makeSlot } from '@/test/slots';
import { createDraft, saveStep, submitIntake } from '@/server/services/booking';
import { sendPendingCapiEvents } from '@/server/services/tracking';

const email = `capi-${Date.now()}@example.com`;
const slotIds: string[] = [];

// Note: this shared dev database always has other open slots (from the seed script and other
// test suites), so "no slot chosen" cannot be exercised here — that's covered directly in
// availability.integration.test.ts. Every booking below claims a slot, so every one gets a
// Schedule event; "Lead only" is covered by the unit-level distinction in booking.ts itself.
async function submittedBooking() {
  const { token } = await createDraft({ fullName: 'CAPI Tester', email, phone: '0821234567' }, {});
  await saveStep(token, 'property', { propertyAddress: '1 Main Rd', propertyType: 'House' });
  await saveStep(token, 'stage', { stage: 'CONSIDERING' });
  await saveStep(token, 'ownership', { ownershipStructure: 'PERSONAL' });
  await saveStep(token, 'parties', { otherParties: 'None' });
  await saveStep(token, 'details', { transactionSummary: 'S', mainConcern: 'C' });
  await saveStep(token, 'intent', { desiredOutcome: 'O' });
  const slot = await makeSlot(8, slotIds.length);
  slotIds.push(slot.id);
  await saveStep(token, 'schedule', { sessionLanguage: 'ENGLISH', slotId: slot.id });
  return submitIntake(token, STEPS);
}

describe('submitIntake + sendPendingCapiEvents (integration, real Postgres)', () => {
  beforeEach(() => sendCapiEvent.mockReset().mockResolvedValue({ success: true }));

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { email } });
    await deleteSlots(slotIds);
    await prisma.$disconnect();
  });

  it('creates a Lead event always, and a Schedule event only when a slot was actually claimed', async () => {
    const withSlot = await submittedBooking();
    const withSlotEvents = await prisma.trackedEvent.findMany({ where: { bookingId: withSlot.id } });
    expect(withSlotEvents.map((e) => e.eventName).sort()).toEqual(['LEAD', 'SCHEDULE']);
    expect(new Set(withSlotEvents.map((e) => e.eventId)).size).toBe(2); // each event_id is unique

    const again = await submittedBooking();
    const againEvents = await prisma.trackedEvent.findMany({ where: { bookingId: again.id } });
    expect(againEvents.map((e) => e.eventName).sort()).toEqual(['LEAD', 'SCHEDULE']);
  });

  it('sends each pending event with its own event_id and the request context, and marks it sent', async () => {
    const booking = await submittedBooking();
    await sendPendingCapiEvents(booking.id, { ip: '9.9.9.9', userAgent: 'UA', fbc: 'fb.c', fbp: 'fb.p' });

    expect(sendCapiEvent).toHaveBeenCalledTimes(2);
    const names = sendCapiEvent.mock.calls.map((c) => c[0].eventName).sort();
    expect(names).toEqual(['Lead', 'Schedule']);
    for (const call of sendCapiEvent.mock.calls) {
      expect(call[0].userData).toMatchObject({ email, phone: '0821234567', clientIpAddress: '9.9.9.9', fbc: 'fb.c', fbp: 'fb.p' });
    }

    const rows = await prisma.trackedEvent.findMany({ where: { bookingId: booking.id } });
    expect(rows.every((r) => r.capiFiredAt && r.capiSuccess === true)).toBe(true);
  });

  it('never sends the same event twice, and keeps a booking usable if Meta rejects it', async () => {
    sendCapiEvent.mockResolvedValue({ success: false, error: 'boom' });
    const booking = await submittedBooking();

    await sendPendingCapiEvents(booking.id, {});
    expect(sendCapiEvent).toHaveBeenCalledTimes(2); // this booking has both a Lead and a Schedule row
    const rows = await prisma.trackedEvent.findMany({ where: { bookingId: booking.id } });
    expect(rows.every((r) => r.capiSuccess === false && r.capiFiredAt)).toBe(true); // marked attempted — no retry loop

    await sendPendingCapiEvents(booking.id, {}); // calling again must not re-send either row
    expect(sendCapiEvent).toHaveBeenCalledTimes(2);

    const stillThere = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stillThere.intakeSubmittedAt).not.toBeNull();
  });

  it('does nothing when Meta is not configured, without throwing', async () => {
    const restore = { id: process.env.META_PIXEL_ID, token: process.env.META_CAPI_ACCESS_TOKEN };
    process.env.META_PIXEL_ID = '';
    process.env.META_CAPI_ACCESS_TOKEN = '';
    vi.resetModules();
    const { sendPendingCapiEvents: freshSend } = await import('@/server/services/tracking');

    const booking = await submittedBooking();
    await expect(freshSend(booking.id, {})).resolves.toBeUndefined();

    process.env.META_PIXEL_ID = restore.id;
    process.env.META_CAPI_ACCESS_TOKEN = restore.token;
  });
});
