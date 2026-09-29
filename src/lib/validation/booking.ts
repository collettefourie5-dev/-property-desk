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

/** "documents" is purely informational (no upload) and "review" has nothing of its own to submit. */
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
