import { describe, expect, it } from 'vitest';
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
  toSafeErrorPayload,
} from '@/lib/errors';

describe('toSafeErrorPayload', () => {
  it('exposes message/code/status for known AppError subclasses', () => {
    expect(toSafeErrorPayload(new ValidationError('Bad input'))).toEqual({
      message: 'Bad input',
      code: 'VALIDATION_ERROR',
      status: 400,
    });
    expect(toSafeErrorPayload(new UnauthenticatedError())).toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
    });
    expect(toSafeErrorPayload(new ForbiddenError())).toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(toSafeErrorPayload(new NotFoundError())).toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('never leaks internal error messages for unknown errors', () => {
    const dbError = new Error('password authentication failed for user "admin" at 10.0.0.5');
    const payload = toSafeErrorPayload(dbError);

    expect(payload).toEqual({
      message: 'Something went wrong. Please try again.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    expect(payload.message).not.toContain('password');
  });

  it('treats thrown non-Error values the same way', () => {
    expect(toSafeErrorPayload('a raw string throw')).toEqual({
      message: 'Something went wrong. Please try again.',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  });
});
