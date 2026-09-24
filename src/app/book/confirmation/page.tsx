import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDraftToken } from '@/lib/booking-session';
import { getSiteConfig } from '@/lib/site-config';
import { prisma } from '@/lib/db/prisma';
import { formatSlotFull } from '@/lib/time';
import { LANGUAGES } from '@/lib/validation/booking';
import { getBookingByToken } from '@/server/services/booking';

export default async function ConfirmationPage() {
  const booking = await getBookingByToken(await getDraftToken());
  if (!booking?.intakeSubmittedAt) redirect('/book');
  const site = getSiteConfig();
  const slot = await prisma.timeSlot.findUnique({ where: { bookingId: booking.id }, select: { startsAt: true } });
  const language = LANGUAGES.find((l) => l.value === booking.sessionLanguage)?.label;

  return (
    <main>
      <p className="text-sm font-medium uppercase tracking-widest text-accent">Request received</p>
      <h1 className="mt-2 font-serif text-3xl">Thank you, {booking.fullName?.split(' ')[0]}.</h1>
      <p className="mt-4 text-lg">
        Your booking request has been sent to {site.attorneyName}, who will be in touch with you shortly at{' '}
        <strong className="break-all">{booking.email}</strong> to confirm your session and take you through
        pricing.
      </p>
      {slot && (
        <p className="mt-4 rounded-lg bg-surface px-4 py-3">
          <strong>Requested time:</strong> {formatSlotFull(slot.startsAt)}
          {language && <> · {language}</>}
          <br />
          <span className="text-sm text-muted">We will confirm this with you personally, including pricing.</span>
        </p>
      )}
      <p className="mt-4 text-muted">
        We have emailed you a receipt. If you don&rsquo;t see it, please check your spam folder.
      </p>
      <Link href="/what-to-expect" className="mt-8 inline-block underline underline-offset-2">
        What to expect &rarr;
      </Link>
    </main>
  );
}
