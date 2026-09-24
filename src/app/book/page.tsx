import { redirect } from 'next/navigation';
import { getDraftToken } from '@/lib/booking-session';
import { STEPS } from '@/lib/validation/booking';
import { firstIncompleteStep, getBookingByToken } from '@/server/services/booking';

export default async function BookIndexPage() {
  const booking = await getBookingByToken(await getDraftToken());
  if (booking?.intakeSubmittedAt) redirect('/book/confirmation');
  redirect(`/book/${firstIncompleteStep(booking, STEPS)}`);
}
