import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { STEPS } from '@/lib/validation/booking';
import { deleteSlots, makeSlot } from '@/test/slots';
import { createSlots, listOpenSlots, releaseSlot } from '@/server/services/availability';
import { createDraft, getBookingByToken, saveStep, submitIntake } from '@/server/services/booking';

const email = `calendar-${Date.now()}@example.com`;
const slotIds: string[] = [];

async function readyToSchedule(name: string) {
  const { token } = await createDraft({ fullName: name, email, phone: '0821234567' }, {});
  await saveStep(token, 'property', { propertyAddress: '1 Main Rd', propertyType: 'House' });
  await saveStep(token, 'stage', { stage: 'CONSIDERING' });
  await saveStep(token, 'ownership', { ownershipStructure: 'PERSONAL' });
  await saveStep(token, 'parties', { otherParties: 'None' });
  await saveStep(token, 'details', { transactionSummary: 'S', mainConcern: 'C' });
  await saveStep(token, 'intent', { desiredOutcome: 'O' });
  return token;
}

describe('calendar (integration, real Postgres)', () => {
  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { email } });
    await deleteSlots(slotIds);
    await prisma.timeSlot.deleteMany({ where: { id: { in: slotIds } } });
    await prisma.$disconnect();
  });

  it('only offers slots that are open, not too soon, and inside the booking window', async () => {
    const good = await makeSlot(3);
    const tooSoon = await prisma.timeSlot.create({
      data: { startsAt: new Date(Date.now() + 3 * 3_600_000), endsAt: new Date(Date.now() + 4 * 3_600_000) },
    });
    const past = await prisma.timeSlot.create({
      data: { startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() - 82_800_000) },
    });
    const farAway = await makeSlot(200);
    const blocked = await prisma.timeSlot.create({
      data: { startsAt: new Date(Date.now() + 4 * 86_400_000), endsAt: new Date(Date.now() + 4 * 86_400_000 + 3_600_000), status: 'BLOCKED' },
    });
    slotIds.push(good.id, tooSoon.id, past.id, farAway.id, blocked.id);

    const offered = new Set((await listOpenSlots()).map((s) => s.id));
    expect(offered.has(good.id)).toBe(true);
    for (const excluded of [tooSoon, past, farAway, blocked]) expect(offered.has(excluded.id)).toBe(false);
  });

  it('when two clients race for the same time, exactly one gets it and the other can pick again', async () => {
    const contested = await makeSlot(6);
    const alternative = await makeSlot(6, 2);
    slotIds.push(contested.id, alternative.id);

    const a = await readyToSchedule('Racer A');
    const b = await readyToSchedule('Racer B');
    await saveStep(a, 'schedule', { sessionLanguage: 'ENGLISH', slotId: contested.id });
    await saveStep(b, 'schedule', { sessionLanguage: 'AFRIKAANS', slotId: contested.id });

    const results = await Promise.allSettled([submitIntake(a, STEPS), submitIntake(b, STEPS)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const loserToken = results[0].status === 'rejected' ? a : b;

    const loserBooking = await getBookingByToken(loserToken);
    expect(loserBooking?.intakeSubmittedAt).toBeNull();
    expect(loserBooking?.preferredSlotId).toBeNull(); // sent back to choose again

    // Only one booking holds the contested slot.
    expect(await prisma.timeSlot.count({ where: { id: contested.id, status: 'BOOKED' } })).toBe(1);

    await saveStep(loserToken, 'schedule', { sessionLanguage: 'ENGLISH', slotId: alternative.id });
    expect((await submitIntake(loserToken, STEPS)).intakeSubmittedAt).not.toBeNull();
  });

  it('refuses a made-up, booked or missing slot, and requires a time while any are open', async () => {
    const token = await readyToSchedule('Picky');
    await expect(saveStep(token, 'schedule', { sessionLanguage: 'ENGLISH', slotId: 'not-a-slot' })).rejects.toThrow(
      /no longer available/,
    );
    await expect(saveStep(token, 'schedule', { sessionLanguage: 'ENGLISH' })).rejects.toThrow();
    await expect(saveStep(token, 'schedule', { sessionLanguage: 'GERMAN', slotId: slotIds[0] })).rejects.toThrow();
  });

  it('releasing a held time makes it bookable again', async () => {
    const slot = await makeSlot(7);
    slotIds.push(slot.id);
    const token = await readyToSchedule('Releaser');
    await saveStep(token, 'schedule', { sessionLanguage: 'ENGLISH', slotId: slot.id });
    await submitIntake(token, STEPS);

    expect((await listOpenSlots()).some((s) => s.id === slot.id)).toBe(false);
    await releaseSlot(slot.id);
    expect((await listOpenSlots()).some((s) => s.id === slot.id)).toBe(true);
  });

  it('bulk-creates slots from a rule and skips ones that already exist', async () => {
    const day = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const rule = { startDate: day, endDate: day, weekdays: [weekday], firstStart: '09:00', lastEnd: '12:00', durationMinutes: 60 };

    const first = await createSlots(rule);
    expect(first).toEqual({ created: 3, skipped: 0 });
    const second = await createSlots(rule);
    expect(second).toEqual({ created: 0, skipped: 3 });

    const created = await prisma.timeSlot.findMany({ where: { startsAt: { gte: new Date(`${day}T00:00:00+02:00`), lt: new Date(`${day}T23:59:00+02:00`) } } });
    slotIds.push(...created.map((c) => c.id));
  });
});
