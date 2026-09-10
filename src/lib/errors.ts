/** Base class for errors that are safe to describe to the client (no internals leaked). */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  readonly fieldErrors?: Record<string, string[]>;
  constructor(message = 'Invalid input', fieldErrors?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHENTICATED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to do this') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests, please try again shortly') {
    super(message, 429, 'RATE_LIMITED');
  }
}

/** Never expose internal error messages/stack traces for non-AppError failures. */
export function toSafeErrorPayload(error: unknown): { message: string; code: string; status: number } {
  if (error instanceof AppError) {
    return { message: error.message, code: error.code, status: error.status };
  }
  return { message: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR', status: 500 };
}
