'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireRole } from '@/lib/permissions';
import { AppError } from '@/lib/errors';
import { AuditAction, recordAuditEvent } from '@/server/services/audit';
import { createSlots, deleteOpenSlot } from '@/server/services/availability';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time');

const ruleSchema = z.object({
  startDate: date,
  endDate: date,
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, 'Choose at least one weekday'),
  firstStart: time,
  lastEnd: time,
  durationMinutes: z.coerce.number().int().min(15).max(240),
});

function back(kind: 'ok' | 'error', message: string): never {
  redirect(`/admin/availability?${kind}=${encodeURIComponent(message)}`);
}

/** Adds slots for a recurring rule (e.g. Mon–Fri, 09:00–16:00, hourly, for the next two weeks). */
export async function addSlots(formData: FormData): Promise<void> {
  const session = await requireRole('ADMIN');

  const parsed = ruleSchema.safeParse({
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    weekdays: formData.getAll('weekdays'),
    firstStart: formData.get('firstStart'),
    lastEnd: formData.get('lastEnd'),
    durationMinutes: formData.get('durationMinutes'),
  });
  if (!parsed.success) back('error', parsed.error.issues[0]?.message ?? 'Check the form and try again');
  if (parsed.data.endDate < parsed.data.startDate) back('error', 'The end date is before the start date');

  let message: string;
  try {
    const { created, skipped } = await createSlots(parsed.data);
    await recordAuditEvent({
      actorId: session.user.id,
      action: AuditAction.ADMIN_ACTION,
      targetType: 'TimeSlot',
      metadata: { action: 'add_slots', created, skipped, rule: parsed.data },
    });
    message = `Added ${created} time${created === 1 ? '' : 's'}${skipped ? ` (${skipped} already existed)` : ''}`;
  } catch (error) {
    if (error instanceof AppError) back('error', error.message);
    throw error;
  }
  revalidatePath('/admin/availability');
  back('ok', message);
}

export async function deleteSlot(formData: FormData): Promise<void> {
  const session = await requireRole('ADMIN');
  const id = z.string().min(1).max(64).parse(formData.get('id'));

  try {
    await deleteOpenSlot(id);
    await recordAuditEvent({
      actorId: session.user.id,
      action: AuditAction.ADMIN_ACTION,
      targetType: 'TimeSlot',
      targetId: id,
      metadata: { action: 'delete_slot' },
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
  }
  revalidatePath('/admin/availability');
}
