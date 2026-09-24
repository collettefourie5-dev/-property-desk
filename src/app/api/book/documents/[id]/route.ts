import { NextResponse } from 'next/server';
import { getDraftToken } from '@/lib/booking-session';
import { AppError, ValidationError, toSafeErrorPayload } from '@/lib/errors';
import { logger } from '@/lib/logging/logger';
import { removeDocument } from '@/server/services/booking';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, ctx: RouteContext<'/api/book/documents/[id]'>) {
  try {
    const { id } = await ctx.params;
    const token = await getDraftToken();
    if (!token) throw new ValidationError('Your session has expired. Please start again.');

    await removeDocument(token, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (!(error instanceof AppError)) {
      logger.error('Document removal failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
    const { message, code, status } = toSafeErrorPayload(error);
    return NextResponse.json({ error: { message, code } }, { status });
  }
}
