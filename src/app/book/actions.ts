'use server';

import { headers, cookies } from 'next/headers';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { ATTRIBUTION_COOKIE, parseAttributionCookie } from '@/lib/attribution';
import { getDraftToken, setDraftToken } from '@/lib/booking-session';
import { AppError, ValidationError, toSafeErrorPayload } from '@/lib/errors';
import { logger } from '@/lib/logging/logger';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { STEPS, contactSchema, stepSchema, type Step } from '@/lib/validation/booking';
import {
  createDraft,
  getBookingByToken,
  saveStep,
  submitIntake,
  updateContact,
} from '@/server/services/booking';
import { notifyNewBooking } from '@/server/services/notifications';

export type FormState =
  | { errors?: Record<string, string[]>; message?: string; values?: Record<string, string> }
  | undefined;

function toValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && key !== 'step' && !key.startsWith('$ACTION')) values[key] = value;
  }
  return values;
}

/**
 * One action for every wizard step. The step comes from the form but is validated against the
 * known list, each step's data is re-validated server-side, and the booking is always found via
 * the httpOnly draft cookie — never via an id from the browser.
 */
export async function saveStepAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = toValues(formData);
  const stepResult = stepSchema.safeParse(formData.get('step'));
  if (!stepResult.success) return { message: 'Something went wrong. Please try again.', values };
  const step: Step = stepResult.data;

  try {
    const token = await getDraftToken();

    if (step === 'contact') {
      const parsed = contactSchema.safeParse(values);
      if (!parsed.success) {
        return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]>, values };
      }
      const { fullName, email, phone } = parsed.data;

      // A cookie can outlive its booking (expired, removed by an admin); that must start a fresh
      // booking, not trap the visitor on this step.
      if (token && (await getBookingByToken(token))) {
        await updateContact(token, { fullName, email, phone });
      } else {
        enforceRateLimit({
          name: 'booking:start',
          identity: clientIp(await headers()),
          limit: 10,
          windowMs: 60 * 60 * 1000,
        });
        const attribution = parseAttributionCookie((await cookies()).get(ATTRIBUTION_COOKIE)?.value);
        const created = await createDraft({ fullName, email, phone }, attribution);
        await setDraftToken(created.token);
      }
    } else if (step === 'review') {
      if (!token) return { message: 'Your session has expired. Please start again.', values };
      const submitted = await submitIntake(token, STEPS);
      // Email the attorney after the response is sent; the booking is already saved, so a slow or
      // failed email never blocks or loses the request (see notifyNewBooking).
      after(() => notifyNewBooking(submitted.id));
    } else {
      if (!token) return { message: 'Your session has expired. Please start again.', values };
      await saveStep(token, step, values);
    }
  } catch (error) {
    if (error instanceof ValidationError && error.fieldErrors) {
      return { errors: error.fieldErrors, values };
    }
    if (!(error instanceof AppError)) {
      logger.error('Booking step failed', {
        step,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return { message: toSafeErrorPayload(error).message, values };
  }

  // redirect() throws, so it stays outside the try/catch.
  redirect(step === 'review' ? '/book/confirmation' : `/book/${STEPS[STEPS.indexOf(step) + 1]}`);
}
