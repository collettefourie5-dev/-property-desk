import { createHash } from 'node:crypto';

/** Meta's required normalization before hashing: lowercase, trim, no internal whitespace. */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/** Digits only (Meta's normalized phone format), then SHA-256. */
export function hashPhone(phone: string): string {
  return createHash('sha256').update(phone.replace(/\D/g, '')).digest('hex');
}
