import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { prisma } from '@/lib/db/prisma';
import { getEnv } from '@/lib/env';
import { sendEmail } from '@/lib/email/email';
import { recordAuditEvent, AuditAction } from '@/server/services/audit';
import { logger } from '@/lib/logging/logger';

const env = getEnv();

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  // Internal/admin users only (staff). The public booking flow never touches this.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // accounts are staff-created; verify manually if needed
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset your The Property Desk admin password',
        html: `<p>Reset your password: <a href="${url}">${url}</a></p><p>If you didn't request this, ignore this email.</p>`,
        text: `Reset your password: ${url}`,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Verify your The Property Desk admin email',
        html: `<p>Verify your email: <a href="${url}">${url}</a></p>`,
        text: `Verify your email: ${url}`,
      });
    },
  },

  user: {
    additionalFields: {
      role: { type: 'string', input: false, defaultValue: 'USER' },
      status: { type: 'string', input: false, defaultValue: 'ACTIVE' },
      lastLoginAt: { type: 'date', input: false, required: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
  },

  hooks: {
    // /sign-out deletes the session inside its own handler without exposing it on
    // ctx.context (verified against the installed better-auth source) — so it must be
    // captured *before* the endpoint runs, not in an `after` hook like /sign-in/email.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-out') {
        const session = await auth.api.getSession({ headers: ctx.headers ?? new Headers() });
        if (session) {
          await recordAuditEvent({
            actorId: session.user.id,
            action: AuditAction.LOGOUT,
            targetType: 'User',
            targetId: session.user.id,
          });
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-in/email' && ctx.context.newSession) {
        const { user } = ctx.context.newSession;
        const ip = ctx.request?.headers.get('x-forwarded-for') ?? undefined;

        await prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch((error: unknown) =>
            logger.error('Failed to update lastLoginAt', {
              userId: user.id,
              message: error instanceof Error ? error.message : String(error),
            }),
          );

        await recordAuditEvent({
          actorId: user.id,
          action: AuditAction.LOGIN,
          targetType: 'User',
          targetId: user.id,
          ipAddress: ip,
        });
      }
    }),
  },
});

/**
 * Server-side-only account creation (seed script, future admin "invite staff" action).
 * Never exposed over HTTP — see src/app/api/auth/[...all]/route.ts, which blocks the
 * public /sign-up/email endpoint outright. There is no public self-registration.
 */
export async function createStaffAccount(input: {
  name: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
}) {
  const result = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
  });
  if (!result.user) {
    throw new APIError('BAD_REQUEST', { message: 'Failed to create account' });
  }
  await prisma.user.update({ where: { id: result.user.id }, data: { role: input.role } });
  await recordAuditEvent({
    actorId: null,
    action: AuditAction.USER_CREATED,
    targetType: 'User',
    targetId: result.user.id,
    metadata: { role: input.role, via: 'createStaffAccount' },
  });
  return result.user;
}
