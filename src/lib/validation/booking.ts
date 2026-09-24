import { z } from 'zod';

/** Wizard steps in the exact order specified. Payment and scheduling follow `review`. */
export const STEPS = [
  'contact',
  'property',
  'stage',
  'ownership',
  'parties',
  'details',
  'documents',
  'intent',
  'schedule',
  'review',
] as const;
export type Step = (typeof STEPS)[number];
export const stepSchema = z.enum(STEPS);

export const STAGES = [
  { value: 'CONSIDERING', label: 'Considering selling' },
  { value: 'PREPARING', label: 'Preparing to sell' },
  { value: 'NEGOTIATING', label: 'Negotiating with a buyer' },
  { value: 'HAVE_OTP', label: 'I have an OTP / offer' },
  { value: 'ALREADY_SIGNED', label: 'I have already signed' },
] as const;

export const OWNERSHIPS = [
  { value: 'PERSONAL', label: 'Personal name' },
  { value: 'JOINT', label: 'Joint owners (e.g. spouses)' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'ESTATE', label: 'Deceased estate' },
] as const;

export const LANGUAGES = [
  { value: 'ENGLISH', label: 'English' },
  { value: 'AFRIKAANS', label: 'Afrikaans' },
] as const;

export const PROPERTY_TYPES = [
  'House',
  'Sectional title / apartment',
  'Vacant land',
  'Farm / smallholding',
  'Commercial property',
  'Other',
] as const;

const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const contactSchema = z.object({
  fullName: text(120, 'Your name'),
  email: z.email('Enter a valid email address').trim().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{7,18}$/, 'Enter a valid phone number'),
  consent: z.literal('on', { error: 'You must accept the privacy notice to continue' }),
});

export const propertySchema = z.object({
  propertyAddress: text(300, 'Property address'),
  propertyType: z.enum(PROPERTY_TYPES, { error: 'Choose a property type' }),
});

export const stageSchema = z.object({
  stage: z.enum(STAGES.map((s) => s.value) as [string, ...string[]], {
    error: 'Choose where you are in the transaction',
  }),
});

export const ownershipSchema = z.object({
  ownershipStructure: z.enum(OWNERSHIPS.map((o) => o.value) as [string, ...string[]], {
    error: 'Choose how the property is owned',
  }),
});

export const partiesSchema = z.object({
  otherParties: text(1000, 'Other parties'),
});

export const detailsSchema = z.object({
  transactionSummary: text(4000, 'A description of the transaction'),
  mainConcern: text(2000, 'Your main concern'),
});

export const intentSchema = z.object({
  desiredOutcome: text(1000, 'What you would like to achieve'),
});

/** The slot is validated against the live calendar in the booking service, not just its shape here. */
export const scheduleSchema = z.object({
  sessionLanguage: z.enum(LANGUAGES.map((l) => l.value) as [string, ...string[]], {
    error: 'Choose the language for your session',
  }),
  slotId: z.string().trim().max(64).optional(),
});

/** Documents are uploaded via /api/book/documents; the step itself has no required fields. */
export const documentsSchema = z.object({});
export const reviewSchema = z.object({});

export const stepSchemas = {
  contact: contactSchema,
  property: propertySchema,
  stage: stageSchema,
  ownership: ownershipSchema,
  parties: partiesSchema,
  details: detailsSchema,
  documents: documentsSchema,
  intent: intentSchema,
  schedule: scheduleSchema,
  review: reviewSchema,
} as const;

// --- Documents -----------------------------------------------------------------------

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENTS = 8;

export const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
} as const;
export type AllowedMime = keyof typeof ALLOWED_DOCUMENT_TYPES;

/**
 * Identifies the real file type from its leading bytes, ignoring the client-supplied
 * MIME type and filename (both attacker-controlled). Returns null for anything not allowed.
 */
export function sniffDocumentType(bytes: Uint8Array): AllowedMime | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

  if (starts([0x25, 0x50, 0x44, 0x46])) return 'application/pdf'; // %PDF
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (starts([0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (['heic', 'heix', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  if (starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'application/msword';
  if (starts([0x50, 0x4b, 0x03, 0x04])) {
    // A .docx is a ZIP; require the Word part name so arbitrary ZIPs are rejected.
    const head = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
    if (head.includes('[Content_Types].xml') || head.includes('word/')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
  }
  return null;
}

/** Display-only cleanup of a client filename: no path parts, no control characters, bounded length. */
export function safeDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'document';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'document').slice(0, 150);
}
