import { describe, expect, it } from 'vitest';
import {
  MAX_GENERATED_SLOTS,
  formatSlotFull,
  generateSlots,
  parseSastLocal,
  sastDateKey,
} from '@/lib/time';

describe('South African time handling', () => {
  it('treats wall-clock input as SAST (UTC+2), whatever the server timezone is', () => {
    expect(parseSastLocal('2026-10-05', '09:00').toISOString()).toBe('2026-10-05T07:00:00.000Z');
  });

  it('displays a slot in SA time even though it is stored in UTC', () => {
    const slot = parseSastLocal('2026-10-05', '09:00');
    expect(formatSlotFull(slot)).toContain('09:00');
    expect(formatSlotFull(slot)).toContain('5 October');
  });

  it('puts a late-evening UTC instant on the correct SA calendar day', () => {
    // 23:30 UTC on the 5th is 01:30 SAST on the 6th.
    expect(sastDateKey(new Date('2026-10-05T23:30:00Z'))).toBe('2026-10-06');
  });
});

describe('generateSlots', () => {
  it('creates hourly slots on the chosen weekdays only', () => {
    // 5–11 Oct 2026 is Mon–Sun; ask for Mon + Wed, 09:00–12:00, 60 min.
    const slots = generateSlots({
      startDate: '2026-10-05',
      endDate: '2026-10-11',
      weekdays: [1, 3],
      firstStart: '09:00',
      lastEnd: '12:00',
      durationMinutes: 60,
    });
    expect(slots).toHaveLength(6);
    expect(slots[0].startsAt.toISOString()).toBe('2026-10-05T07:00:00.000Z');
    expect(slots[2].endsAt.toISOString()).toBe('2026-10-05T10:00:00.000Z');
    expect(slots[3].startsAt.toISOString()).toBe('2026-10-07T07:00:00.000Z');
  });

  it('never lets a slot run past the end of the window', () => {
    const slots = generateSlots({
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      weekdays: [1],
      firstStart: '09:00',
      lastEnd: '10:30',
      durationMinutes: 60,
    });
    expect(slots).toHaveLength(1);
  });

  it('returns nothing for nonsense input', () => {
    const base = { startDate: '2026-10-05', endDate: '2026-10-09', weekdays: [1], firstStart: '09:00' };
    expect(generateSlots({ ...base, lastEnd: '08:00', durationMinutes: 60 })).toEqual([]);
    expect(generateSlots({ ...base, lastEnd: '17:00', durationMinutes: 5 })).toEqual([]);
  });

  it('stops runaway ranges instead of generating thousands of slots', () => {
    const slots = generateSlots({
      startDate: '2026-01-01',
      endDate: '2030-12-31',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      firstStart: '00:00',
      lastEnd: '23:00',
      durationMinutes: 15,
    });
    expect(slots.length).toBeLessThanOrEqual(MAX_GENERATED_SLOTS + 1);
  });
});
