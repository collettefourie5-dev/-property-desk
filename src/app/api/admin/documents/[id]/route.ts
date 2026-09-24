import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/permissions';
import { getStorage } from '@/lib/storage';
import { AuditAction, recordAuditEvent } from '@/server/services/audit';

export const dynamic = 'force-dynamic';

/** Admin-only download of a client's uploaded document. Every download is audit-logged. */
export async function GET(_request: Request, ctx: RouteContext<'/api/admin/documents/[id]'>) {
  const session = await requireRole('ADMIN');
  const { id } = await ctx.params;

  const doc = await prisma.bookingDocument.findUnique({ where: { id } });
  if (!doc) return new Response('Not found', { status: 404 });

  const { body } = await getStorage().get(doc.storageKey);
  await recordAuditEvent({
    actorId: session.user.id,
    action: AuditAction.ADMIN_ACTION,
    targetType: 'BookingDocument',
    targetId: doc.id,
    metadata: { action: 'download_document', bookingId: doc.bookingId },
  });

  const safeName = doc.originalName.replace(/["\\\r\n]/g, '_');
  return new Response(new Uint8Array(body), {
    headers: {
      // The type was verified from the file's bytes at upload; `attachment` + nosniff means it is
      // downloaded, never rendered inside our origin.
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
