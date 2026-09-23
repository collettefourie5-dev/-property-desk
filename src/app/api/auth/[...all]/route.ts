import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth/auth';

const handlers = toNextJsHandler(auth);

export const { GET } = handlers;

/**
 * There is no public self-registration — accounts are staff-created only
 * (see createStaffAccount in src/lib/auth/auth.ts, used by the seed script and,
 * later, an admin-only "add staff" action). Block the endpoint at the HTTP layer;
 * everything else Better Auth handles (sign-in, sign-out, session, password reset) passes through.
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.endsWith('/sign-up/email')) {
    return Response.json({ error: 'Account creation is invite-only.' }, { status: 403 });
  }
  return handlers.POST(request);
}
