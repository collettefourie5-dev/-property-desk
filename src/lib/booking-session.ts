import { cookies } from 'next/headers';
import { getEnv } from '@/lib/env';

export const DRAFT_COOKIE = 'pd_draft';
const SEVEN_DAYS = 60 * 60 * 24 * 7;

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
    maxAge: SEVEN_DAYS,
  });
}
