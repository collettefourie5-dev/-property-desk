import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDraftToken } from '@/lib/booking-session';
import { getSiteConfig } from '@/lib/site-config';
import { getBookingByToken } from '@/server/services/booking';

export default async function ConfirmationPage() {
  const booking = await getBookingByToken(await getDraftToken());
  if (!booking?.intakeSubmittedAt) redirect('/book');
  const site = getSiteConfig();

  return (
    <main>
      <p className="text-sm font-medium uppercase tracking-widest text-accent">Request received</p>
      <h1 className="mt-2 font-serif text-3xl">Thank you, {booking.fullName?.split(' ')[0]}.</h1>
      <p className="mt-4 text-lg">
        Your booking request has been sent to {site.attorneyName}, who will be in touch with you shortly at{' '}
        <strong className="break-all">{booking.email}</strong> to arrange your session.
      </p>
      <p className="mt-4 text-muted">
        We have emailed you a receipt. If you don&rsquo;t see it, please check your spam folder.
      </p>
      <Link href="/what-to-expect" className="mt-8 inline-block underline underline-offset-2">
        What to expect &rarr;
      </Link>
    </main>
  );
}
