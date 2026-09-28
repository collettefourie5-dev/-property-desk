import { cookies } from 'next/headers';
import { getEnv } from '@/lib/env';

export const DRAFT_COOKIE = 'pd_draft';
// A session can be booked up to HORIZON_DAYS (60, see availability.ts) ahead, and the document
// reminder + "upload your documents" link need the cookie to still be valid right up to that
// session — so this must outlive the horizon, not just the few minutes/hours a wizard visit takes.
const COOKIE_LIFETIME_DAYS = 70;

export async function getDraftToken(): Promise<string | undefined> {
  return (await cookies()).get(DRAFT_COOKIE)?.value;
}

/** httpOnly so page scripts (including any injected/third-party one) can never read the booking credential. */
export async function setDraftToken(token: string): Promise<void> {
  (await cookies()).set(DRAFT_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getEnv().NEXT_PUBLIC_APP_URL.startsWith('https://'),
    path: '/',
    maxAge: COOKIE_LIFETIME_DAYS * 24 * 60 * 60,
  });
}
