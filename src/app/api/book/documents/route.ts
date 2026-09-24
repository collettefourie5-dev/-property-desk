import { NextResponse } from 'next/server';
import { getDraftToken } from '@/lib/booking-session';
import { AppError, ValidationError, toSafeErrorPayload } from '@/lib/errors';
import { logger } from '@/lib/logging/logger';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { MAX_DOCUMENT_BYTES } from '@/lib/validation/booking';
import { addDocument } from '@/server/services/booking';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown) {
  if (!(error instanceof AppError)) {
    logger.error('Document upload failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const { message, code, status } = toSafeErrorPayload(error);
  return NextResponse.json({ error: { message, code } }, { status });
}

export async function POST(request: Request) {
  try {
    enforceRateLimit({
      name: 'booking:upload',
      identity: clientIp(request.headers),
      limit: 40,
      windowMs: 60 * 60 * 1000,
    });

    const token = await getDraftToken();
    if (!token) throw new ValidationError('Your session has expired. Please start again.');

    // Reject oversized bodies before buffering them (multipart adds a little overhead).
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_DOCUMENT_BYTES + 64 * 1024) {
      throw new ValidationError(`Each file must be ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB or smaller`);
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new ValidationError('No file received');

    const document = await addDocument(token, {
      name: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
