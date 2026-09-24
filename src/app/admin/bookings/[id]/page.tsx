import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { bookingDetailRows } from '@/lib/email/templates/booking';
import { requireRole } from '@/lib/permissions';
import { recordAuditEvent, AuditAction } from '@/server/services/audit';
import { releaseBookingSlot, resendBookingEmail, setPaymentStatus } from '../actions';

const buttonClass =
  'rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100';

export default async function AdminBookingPage(props: PageProps<'/admin/bookings/[id]'>) {
  const session = await requireRole('ADMIN');
  const { id } = await props.params;

  const booking = await prisma.booking.findFirst({
    where: { id, intakeSubmittedAt: { not: null } },
    include: { documents: { orderBy: { uploadedAt: 'asc' } }, timeSlot: { select: { id: true, startsAt: true } } },
  });
  if (!booking) notFound();

  // Client confidences are being read — leave a trail of who looked.
  await recordAuditEvent({
    actorId: session.user.id,
    action: AuditAction.ADMIN_ACTION,
    targetType: 'Booking',
    targetId: booking.id,
    metadata: { action: 'view_booking' },
  });

  const source = [booking.utmSource, booking.utmCampaign, booking.utmContent, booking.landingPageVariantSlug]
    .filter(Boolean)
    .join(' / ');

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/admin/bookings" className="text-sm underline underline-offset-2">
        &larr; All bookings
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{booking.fullName}</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Received {booking.intakeSubmittedAt?.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}
        {source && ` · from ${source}`}
      </p>

      <dl className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {bookingDetailRows(booking)
          .filter(([label]) => label !== 'Documents')
          .map(([label, value]) => (
            <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
              <dt className="text-sm text-neutral-500">{label}</dt>
              <dd className="whitespace-pre-wrap break-words">{value}</dd>
            </div>
          ))}
      </dl>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Documents</h2>
        {booking.documents.length === 0 ? (
          <p className="text-sm text-neutral-500">None uploaded.</p>
        ) : (
          <ul className="space-y-2">
            {booking.documents.map((d) => (
              <li key={d.id}>
                <a
                  href={`/api/admin/documents/${d.id}`}
                  className="underline underline-offset-2"
                  download
                >
                  {d.originalName}
                </a>{' '}
                <span className="text-sm text-neutral-500">({Math.max(1, Math.round(d.sizeBytes / 1024))} KB)</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {booking.timeSlot && (
        <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">
            This time is held for the client until you release it (for example if you reschedule).
          </p>
          <form action={releaseBookingSlot} className="mt-2">
            <input type="hidden" name="id" value={booking.id} />
            <input type="hidden" name="slotId" value={booking.timeSlot.id} />
            <button className={buttonClass}>Release this time</button>
          </form>
        </section>
      )}

      <section className="mt-6 flex flex-wrap items-center gap-6 rounded-lg border border-neutral-200 bg-white p-4">
        <div>
          <p className="text-sm text-neutral-500">Session fee: {booking.paymentStatus}</p>
          <form action={setPaymentStatus} className="mt-2 flex gap-2">
            <input type="hidden" name="id" value={booking.id} />
            <button name="status" value="PAID" className={buttonClass}>
              Mark paid
            </button>
            <button name="status" value="PENDING" className={buttonClass}>
              Mark unpaid
            </button>
          </form>
        </div>
        <div>
          <p className="text-sm text-neutral-500">
            Email to you: {booking.adminNotifiedAt ? 'sent' : 'NOT sent'}
          </p>
          <form action={resendBookingEmail} className="mt-2">
            <input type="hidden" name="id" value={booking.id} />
            <button className={buttonClass}>Resend email</button>
          </form>
        </div>
      </section>
    </main>
  );
}
