import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import type { Attribution } from '@/lib/attribution';
import { getStorage } from '@/lib/storage';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENTS,
  MAX_DOCUMENT_BYTES,
  safeDisplayName,
  sniffDocumentType,
  stepSchemas,
  type Step,
} from '@/lib/validation/booking';
import type { Prisma } from '@/generated/prisma/client';

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

const withDocuments = { documents: { orderBy: { uploadedAt: 'asc' as const } } };
export type BookingWithDocuments = Prisma.BookingGetPayload<{ include: typeof withDocuments }>;

export async function getBookingByToken(token: string | undefined): Promise<BookingWithDocuments | null> {
  if (!token) return null;
  return prisma.booking.findUnique({
    where: { draftToken: hashToken(token) },
    include: withDocuments,
  });
}

/** True when the fields a step requires are already saved. Documents are optional, so never block. */
export function isStepComplete(booking: BookingWithDocuments, step: Step): boolean {
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
      return true;
    case 'intent':
      return Boolean(booking.desiredOutcome);
    case 'review':
      return Boolean(booking.intakeSubmittedAt);
  }
}

/** The earliest step still needing input — the server refuses to let anyone skip ahead of it. */
export function firstIncompleteStep(booking: BookingWithDocuments | null, steps: readonly Step[]): Step {
  if (!booking) return steps[0];
  return steps.find((s) => s !== 'review' && !isStepComplete(booking, s)) ?? 'review';
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

export async function addDocument(
  token: string,
  file: { name: string; bytes: Buffer },
): Promise<{ id: string; originalName: string; sizeBytes: number }> {
  const booking = await getBookingByToken(token);
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.intakeSubmittedAt) throw new ConflictError('This booking has already been submitted');
  if (booking.documents.length >= MAX_DOCUMENTS) {
    throw new ValidationError(`You can upload up to ${MAX_DOCUMENTS} documents`);
  }
  if (file.bytes.length === 0) throw new ValidationError('That file is empty');
  if (file.bytes.length > MAX_DOCUMENT_BYTES) {
    throw new ValidationError(`Each file must be ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB or smaller`);
  }

  const mimeType = sniffDocumentType(file.bytes);
  if (!mimeType) throw new ValidationError('Only PDF, Word documents and images (JPG, PNG, WebP, HEIC) are accepted');

  const storageKey = `bookings/${booking.id}/${randomUUID()}.${ALLOWED_DOCUMENT_TYPES[mimeType]}`;
  await getStorage().put(storageKey, file.bytes, mimeType);

  try {
    const doc = await prisma.bookingDocument.create({
      data: {
        bookingId: booking.id,
        storageKey,
        originalName: safeDisplayName(file.name),
        mimeType,
        sizeBytes: file.bytes.length,
      },
    });
    return { id: doc.id, originalName: doc.originalName, sizeBytes: doc.sizeBytes };
  } catch (error) {
    await getStorage().delete(storageKey).catch(() => undefined);
    throw error;
  }
}

export async function removeDocument(token: string, documentId: string): Promise<void> {
  const booking = await getBookingByToken(token);
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.intakeSubmittedAt) throw new ConflictError('This booking has already been submitted');

  // Ownership check: the document must belong to *this* token's booking.
  const doc = booking.documents.find((d) => d.id === documentId);
  if (!doc) throw new NotFoundError('Document not found');

  await prisma.bookingDocument.delete({ where: { id: doc.id } });
  await getStorage().delete(doc.storageKey).catch(() => undefined);
}

/** Locks the intake in. Everything required must already be complete — re-checked here, not just in the UI. */
export async function submitIntake(token: string, steps: readonly Step[]): Promise<BookingWithDocuments> {
  const booking = await getBookingByToken(token);
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.intakeSubmittedAt) return booking;

  const missing = steps.find((s) => s !== 'review' && !isStepComplete(booking, s));
  if (missing) throw new ValidationError(`Please complete the "${missing}" step first`);

  return prisma.booking.update({
    where: { id: booking.id },
    data: { intakeSubmittedAt: new Date() },
    include: withDocuments,
  });
}
