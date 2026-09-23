import { cache } from 'react';
import { headers } from 'next/headers';
import { unauthorized, forbidden } from 'next/navigation';
import { auth } from '@/lib/auth/auth';

export type Role = 'USER' | 'ADMIN';

/** Memoized per request — safe to call from multiple places in one render/action without re-querying. */
export const getCurrentSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/**
 * Throws (401) if there is no authenticated session. Call in Server Components,
 * Server Actions, and Route Handlers — never rely on hiding UI alone (spec section 4).
 */
export async function requireAuth() {
  const session = await getCurrentSession();
  if (!session) {
    unauthorized();
  }
  return session;
}

/**
 * Throws (401/403) unless the current session has one of the given roles.
 * Always call requireAuth()/requireRole() server-side even when the UI already hides
 * the action for other roles — client-side checks are not a security boundary.
 */
export async function requireRole(...allowed: Role[]) {
  const session = await requireAuth();
  const role = session.user.role as Role;
  if (!allowed.includes(role)) {
    forbidden();
  }
  return session;
}
