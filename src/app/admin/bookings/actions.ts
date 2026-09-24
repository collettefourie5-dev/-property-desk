'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/permissions';
import { AuditAction, recordAuditEvent } from '@/server/services/audit';
import { notifyNewBooking } from '@/server/services/notifications';

const idSchema = z.string().min(1).max(64);
const paymentSchema = z.enum(['PENDING', 'PAID', 'REFUNDED']);

/** Re-sends the booking email to the admin inbox (e.g. after a delivery failure). */
export async function resendBookingEmail(formData: FormData): Promise<void> {
  const session = await requireRole('ADMIN');
  const id = idSchema.parse(formData.get('id'));

  await notifyNewBooking(id, { force: true });
  await recordAuditEvent({
    actorId: session.user.id,
    action: AuditAction.ADMIN_ACTION,
    targetType: 'Booking',
    targetId: id,
    metadata: { action: 'resend_booking_email' },
  });
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath('/admin/bookings');
}

/** There is no online payment: the attorney records here whether the session fee has been received. */
export async function setPaymentStatus(formData: FormData): Promise<void> {
  const session = await requireRole('ADMIN');
  const id = idSchema.parse(formData.get('id'));
  const status = paymentSchema.parse(formData.get('status'));

  await prisma.booking.update({
    where: { id },
    data: { paymentStatus: status, paidAt: status === 'PAID' ? new Date() : null },
  });
  await recordAuditEvent({
    actorId: session.user.id,
    action: AuditAction.ADMIN_ACTION,
    targetType: 'Booking',
    targetId: id,
    metadata: { action: 'set_payment_status', status },
  });
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath('/admin/bookings');
}
