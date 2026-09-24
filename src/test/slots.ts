import { prisma } from '@/lib/db/prisma';

/** Test helper: creates a bookable slot `daysAhead` days out (inside the client booking window). */
export async function makeSlot(daysAhead = 3, hourOffset = 0) {
  const startsAt = new Date(Date.now() + daysAhead * 86_400_000 + hourOffset * 3_600_000);
  startsAt.setMilliseconds(0);
  return prisma.timeSlot.create({
    data: { startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) },
  });
}

export async function deleteSlots(ids: string[]) {
  await prisma.timeSlot.deleteMany({ where: { id: { in: ids } } });
}
