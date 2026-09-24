import { prisma } from '@/lib/db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { MAX_GENERATED_SLOTS, generateSlots, type GenerateSlotsInput } from '@/lib/time';

/** Clients can't book a session starting sooner than this, or further ahead than the horizon. */
export const MIN_NOTICE_HOURS = 12;
export const HORIZON_DAYS = 60;

function openWindow(now: Date) {
  return {
    from: new Date(now.getTime() + MIN_NOTICE_HOURS * 3600_000),
    to: new Date(now.getTime() + HORIZON_DAYS * 86_400_000),
  };
}

/** Slots a client may currently choose from, soonest first. */
export async function listOpenSlots(now = new Date()) {
  const { from, to } = openWindow(now);
  return prisma.timeSlot.findMany({
    where: { status: 'AVAILABLE', bookingId: null, startsAt: { gte: from, lte: to } },
    orderBy: { startsAt: 'asc' },
    select: { id: true, startsAt: true, endsAt: true },
  });
}

export async function hasOpenSlots(now = new Date()): Promise<boolean> {
  const { from, to } = openWindow(now);
  const count = await prisma.timeSlot.count({
    where: { status: 'AVAILABLE', bookingId: null, startsAt: { gte: from, lte: to } },
  });
  return count > 0;
}

/** Throws unless the slot exists and is still open to clients. */
export async function assertSlotOpen(slotId: string, now = new Date()): Promise<void> {
  const { from, to } = openWindow(now);
  const slot = await prisma.timeSlot.findFirst({
    where: { id: slotId, status: 'AVAILABLE', bookingId: null, startsAt: { gte: from, lte: to } },
    select: { id: true },
  });
  if (!slot) throw new ConflictError('That time is no longer available. Please choose another.');
}

// --- Admin -----------------------------------------------------------------------------

/** Creates the slots for a recurring rule, skipping any that already exist. Returns how many were added. */
export async function createSlots(rule: GenerateSlotsInput): Promise<{ created: number; skipped: number }> {
  const wanted = generateSlots(rule);
  if (wanted.length === 0) throw new ValidationError('That rule produces no slots — check the dates and times.');
  if (wanted.length > MAX_GENERATED_SLOTS) {
    throw new ValidationError(`That would create more than ${MAX_GENERATED_SLOTS} slots — use a shorter date range.`);
  }

  const existing = await prisma.timeSlot.findMany({
    where: { startsAt: { in: wanted.map((w) => w.startsAt) } },
    select: { startsAt: true },
  });
  const taken = new Set(existing.map((e) => e.startsAt.getTime()));
  const fresh = wanted.filter((w) => !taken.has(w.startsAt.getTime()));

  if (fresh.length > 0) await prisma.timeSlot.createMany({ data: fresh });
  return { created: fresh.length, skipped: wanted.length - fresh.length };
}

/** Only unbooked slots can be deleted; a booked one must be released from its booking first. */
export async function deleteOpenSlot(slotId: string): Promise<void> {
  const result = await prisma.timeSlot.deleteMany({ where: { id: slotId, status: 'AVAILABLE', bookingId: null } });
  if (result.count === 0) throw new NotFoundError('Slot not found, or it is booked');
}

/** Frees a slot held by a booking (e.g. the attorney declined or rescheduled it). */
export async function releaseSlot(slotId: string): Promise<void> {
  const result = await prisma.timeSlot.updateMany({
    where: { id: slotId, status: 'BOOKED' },
    data: { status: 'AVAILABLE', bookingId: null },
  });
  if (result.count === 0) throw new NotFoundError('Slot not found or not booked');
}

export async function listUpcomingSlotsForAdmin(now = new Date()) {
  return prisma.timeSlot.findMany({
    where: { startsAt: { gte: new Date(now.getTime() - 3600_000) } },
    orderBy: { startsAt: 'asc' },
    take: 400,
    include: { booking: { select: { id: true, fullName: true } } },
  });
}
