/**
 * All sessions happen in South Africa. SAST (UTC+2) has no daylight saving, so a fixed offset is
 * exact — every slot is stored as a UTC instant and always *displayed* in Africa/Johannesburg,
 * regardless of the visitor's or the server's timezone.
 */
export const SA_TIMEZONE = 'Africa/Johannesburg';
const SAST_OFFSET = '+02:00';

/** "2026-10-05" + "09:00" (South African wall-clock time) -> the UTC instant. */
export function parseSastLocal(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${SAST_OFFSET}`);
}

const dateKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: SA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The South African calendar date ("YYYY-MM-DD") an instant falls on. */
export function sastDateKey(d: Date): string {
  return dateKeyFormat.format(d);
}

export function formatSlotDate(d: Date): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: SA_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

export function formatSlotTime(d: Date): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: SA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** e.g. "Monday, 5 October at 09:00 (South African time)" */
export function formatSlotFull(d: Date): string {
  return `${formatSlotDate(d)} at ${formatSlotTime(d)} (South African time)`;
}

export interface SlotRange {
  startsAt: Date;
  endsAt: Date;
}

export interface GenerateSlotsInput {
  /** "YYYY-MM-DD", inclusive */
  startDate: string;
  /** "YYYY-MM-DD", inclusive */
  endDate: string;
  /** 0 = Sunday … 6 = Saturday */
  weekdays: number[];
  /** "HH:MM" — first slot starts here */
  firstStart: string;
  /** "HH:MM" — the last slot must finish by here */
  lastEnd: string;
  durationMinutes: number;
}

export const MAX_GENERATED_SLOTS = 500;

/** Expands a recurring availability rule into concrete slots. Pure, so it is easy to test. */
export function generateSlots(input: GenerateSlotsInput): SlotRange[] {
  const { startDate, endDate, weekdays, firstStart, lastEnd, durationMinutes } = input;
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const from = toMinutes(firstStart);
  const to = toMinutes(lastEnd);
  if (durationMinutes < 15 || to <= from) return [];

  const slots: SlotRange[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const last = new Date(`${endDate}T00:00:00Z`);

  for (; cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (!weekdays.includes(cursor.getUTCDay())) continue;
    const day = cursor.toISOString().slice(0, 10);

    for (let start = from; start + durationMinutes <= to; start += durationMinutes) {
      const hhmm = (mins: number) =>
        `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      slots.push({
        startsAt: parseSastLocal(day, hhmm(start)),
        endsAt: parseSastLocal(day, hhmm(start + durationMinutes)),
      });
      if (slots.length > MAX_GENERATED_SLOTS) return slots;
    }
  }
  return slots;
}
