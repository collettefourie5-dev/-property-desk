import { redirect } from 'next/navigation';
import { DocumentUploader } from '@/components/booking/document-uploader';
import { getDraftToken } from '@/lib/booking-session';
import { formatSlotFull } from '@/lib/time';
import { MAX_DOCUMENTS } from '@/lib/validation/booking';
import { getBookingByToken } from '@/server/services/booking';
import { prisma } from '@/lib/db/prisma';

/**
 * Where the document reminder email (and the client, any time after submitting) uploads
 * documents. Distinct from the in-wizard /book/documents step, which is unreachable once the
 * intake is submitted — this page is the only way in after that point.
 */
export default async function UploadDocumentsPage() {
  const booking = await getBookingByToken(await getDraftToken());
  if (!booking) redirect('/book');
  if (!booking.intakeSubmittedAt) redirect('/book'); // still mid-wizard — resume normally

  const slot = await prisma.timeSlot.findUnique({
    where: { bookingId: booking.id },
    select: { startsAt: true },
  });

  return (
    <main>
      <h1 className="mt-2 font-serif text-3xl">Upload your documents</h1>
      {slot && <p className="mt-2 text-muted">Your session is {formatSlotFull(slot.startsAt)}.</p>}
      <div className="mt-6">
        <DocumentUploader
          initial={booking.documents.map(({ id, originalName, sizeBytes }) => ({ id, originalName, sizeBytes }))}
          maxFiles={MAX_DOCUMENTS}
          footer={null}
          helperText="OTP, agreement or correspondence — PDF, Word or photos. Up to {max} files, 8MB each."
        />
      </div>
    </main>
  );
}
