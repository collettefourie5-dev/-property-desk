import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import type { Attribution } from '@/lib/attribution';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { stepSchemas, type Step } from '@/lib/validation/booking';
import type { Booking, Prisma } from '@/generated/prisma/client';
import { assertSlotOpen, hasOpenSlots } from '@/server/services/availability';

/**
 * The public booking flow is anonymous. Possession of the draft token (an httpOnly cookie
 * holding 256 random bits) is the only credential, and every function here derives the
 * booking from that token — a booking id supplied by the browser is never trusted.
 * Only a SHA-256 hash of the token is stored, so a database leak can't be replayed.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newDraftToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function getBookingByToken(token: string | undefined): Promise<Booking | null> {
  if (!token) return null;
  return prisma.booking.findUnique({ where: { draftToken: hashToken(token) } });
}

/** True when the fields a step requires are already saved. */
export function isStepComplete(booking: Booking, step: Step, slotsAvailable = true): boolean {
  switch (step) {
    case 'contact':
      return Boolean(booking.fullName && booking.email && booking.phone && booking.consentGivenAt);
    case 'property':
      return Boolean(booking.propertyAddress && booking.propertyType);
    case 'stage':
      return Boolean(booking.stage);
    case 'ownership':
      return Boolean(booking.ownershipStructure);
    case 'parties':
      return Boolean(booking.otherParties);
    case 'details':
      return Boolean(booking.transactionSummary && booking.mainConcern);
    case 'documents':
      // Purely informational (what the attorney will ask for by email) — never blocks progress.
      return true;
    case 'intent':
      return Boolean(booking.desiredOutcome);
    case 'schedule':
      // A time is required whenever the calendar has any open slots; with none open, the client
      // can still send the request and the attorney proposes a time.
      return Boolean(booking.sessionLanguage && (booking.preferredSlotId || !slotsAvailable));
    case 'review':
      return Boolean(booking.intakeSubmittedAt);
  }
}

/** The earliest step still needing input — the server refuses to let anyone skip ahead of it. */
export function firstIncompleteStep(
  booking: Booking | null,
  steps: readonly Step[],
  slotsAvailable = true,
): Step {
  if (!booking) return steps[0];
  return steps.find((s) => s !== 'review' && !isStepComplete(booking, s, slotsAvailable)) ?? 'review';
}

export async function createDraft(
  contact: { fullName: string; email: string; phone: string },
  attribution: Attribution,
): Promise<{ token: string }> {
  const token = newDraftToken();
  await prisma.booking.create({
    data: {
      draftToken: hashToken(token),
      ...contact,
      consentGivenAt: new Date(),
      utmSource: attribution.utmSource,
      utmMedium: attribution.utmMedium,
      utmCampaign: attribution.utmCampaign,
      utmContent: attribution.utmContent,
      utmTerm: attribution.utmTerm,
      landingPageVariantSlug: attribution.variant,
    },
  });
  return { token };
}

/** Validates `raw` against the step's schema (the server is authoritative) and persists it. */
export async function saveStep(token: string, step: Exclude<Step, 'contact'>, raw: unknown) {
  const booking = await getBookingByToken(token);
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.intakeSubmittedAt) throw new ConflictError('This booking has already been submitted');

  const parsed = stepSchemas[step].safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError('Invalid input', parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  if (step === 'schedule') {
    const { sessionLanguage, slotId } = parsed.data as { sessionLanguage: 'ENGLISH' | 'AFRIKAANS'; slotId?: string };
    if (slotId) {
      await assertSlotOpen(slotId);
    } else if (await hasOpenSlots()) {
      throw new ValidationError('Invalid input', { slotId: ['Choose a date and time for your session'] });
    }
    await prisma.booking.update({
      where: { id: booking.id },
      data: { sessionLanguage, preferredSlotId: slotId || null },
    });
    return;
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: parsed.data as Prisma.BookingUpdateInput,
  });
}

export async function updateContact(
  token: string,
  contact: { fullName: string; email: string; phone: string },
) {
  const booking = await getBookingByToken(token);
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.intakeSubmittedAt) throw new ConflictError('This booking has already been submitted');
  await prisma.booking.update({
    where: { id: booking.id },
    data: { ...contact, consentGivenAt: booking.consentGivenAt ?? new Date() },
  });
}

/**
 * Locks the intake in and claims the chosen time slot. Everything required must already be
 * complete — re-checked here, not just in the UI. The claim is atomic, so two clients racing for
 * the same slot can't both get it: the loser gets a ConflictError and picks another time.
 */
export async function submitIntake(token: string, steps: readonly Step[]): Promise<Booking> {
  const booking = await getBookingByToken(token);
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.intakeSubmittedAt) return booking;

  const slotsAvailable = await hasOpenSlots();
  const missing = steps.find((s) => s !== 'review' && !isStepComplete(booking, s, slotsAvailable));
  if (missing) throw new ValidationError(`Please complete the "${missing}" step first`);

  const result = await prisma.$transaction(async (tx) => {
    let slotClaimed = false;
    if (booking.preferredSlotId) {
      const claimed = await tx.timeSlot.updateMany({
        where: {
          id: booking.preferredSlotId,
          status: 'AVAILABLE',
          bookingId: null,
          startsAt: { gt: new Date() },
        },
        data: { status: 'BOOKED', bookingId: booking.id },
      });
      if (claimed.count === 0) return null; // lost the race; nothing was written
      slotClaimed = true;
    }

    // event_id here, shared with the client-side fbq() call for the same logical event, is what
    // lets Meta dedupe the browser and server copies of Lead/Schedule instead of double-counting.
    await tx.trackedEvent.create({
      data: { bookingId: booking.id, eventName: 'LEAD', eventId: randomUUID() },
    });
    if (slotClaimed) {
      await tx.trackedEvent.create({
        data: { bookingId: booking.id, eventName: 'SCHEDULE', eventId: randomUUID() },
      });
    }

    return tx.booking.update({
      where: { id: booking.id },
      data: { intakeSubmittedAt: new Date() },
    });
  });

  if (!result) {
    // Clear the stale preference outside the (empty) transaction so the wizard sends them back to pick again.
    await prisma.booking.update({ where: { id: booking.id }, data: { preferredSlotId: null } });
    throw new ConflictError('That time was just taken by someone else. Please go back and choose another.');
  }
  return result;
}
