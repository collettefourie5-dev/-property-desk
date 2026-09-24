import { redirect } from 'next/navigation';
import { getDraftToken } from '@/lib/booking-session';
import { getBookingByToken } from '@/server/services/booking';

export default async function PaymentPage() {
  const booking = await getBookingByToken(await getDraftToken());
  if (!booking?.intakeSubmittedAt) redirect('/book');

  // Payment (PayFast) is the next build stage; the intake above is already saved and locked in.
  return (
    <main>
      <h1 className="font-serif text-3xl">Payment</h1>
      <p className="mt-3 text-muted">Your details are saved. The payment step is being connected.</p>
    </main>
  );
}
