'use server';

import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ATTRIBUTION_COOKIE, parseAttributionCookie } from '@/lib/attribution';
import { getDraftToken, setDraftToken } from '@/lib/booking-session';
import { AppError, ValidationError, toSafeErrorPayload } from '@/lib/errors';
import { logger } from '@/lib/logging/logger';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { STEPS, contactSchema, stepSchema, type Step } from '@/lib/validation/booking';
import { createDraft, saveStep, submitIntake, updateContact } from '@/server/services/booking';

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

      if (token) {
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
      await submitIntake(token, STEPS);
    } else {
      if (!token) return { message: 'Your session has expired. Please start again.', values };
      await saveStep(token, step, values);
    }
  } catch (error) {
    if (error instanceof ValidationError && error.fieldErrors) {
      return { errors: error.fieldErrors, message: error.message, values };
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
  redirect(step === 'review' ? '/book/payment' : `/book/${STEPS[STEPS.indexOf(step) + 1]}`);
}
