import Link from 'next/link';
import { requireRole } from '@/lib/permissions';
import { formatSlotDate, formatSlotTime, sastDateKey } from '@/lib/time';
import { listUpcomingSlotsForAdmin } from '@/server/services/availability';
import { addSlots, deleteSlot } from './actions';

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const field = 'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm';

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminAvailabilityPage(props: PageProps<'/admin/availability'>) {
  await requireRole('ADMIN');
  const search = await props.searchParams;
  const ok = first(search.ok);
  const error = first(search.error);

  const slots = await listUpcomingSlotsForAdmin();
  const byDay = new Map<string, typeof slots>();
  for (const s of slots) {
    const key = sastDateKey(s.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }

  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  const today = sastDateKey(start);
  const inTwoWeeks = sastDateKey(end);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/admin" className="text-sm underline underline-offset-2">
        &larr; Admin
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-semibold">Availability</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Clients can only choose from the open times below. All times are South African time. A time is
        hidden from clients as soon as someone requests it, and stays held until you release it.
      </p>

      {ok && <p role="status" className="mb-4 rounded-md bg-green-50 px-4 py-3 text-green-800">{ok}</p>}
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 px-4 py-3 text-red-800">{error}</p>}

      <form action={addSlots} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="font-medium">Add open times</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            From date
            <input type="date" name="startDate" defaultValue={today} required className={field} />
          </label>
          <label className="text-sm">
            To date
            <input type="date" name="endDate" defaultValue={inTwoWeeks} required className={field} />
          </label>
        </div>
        <fieldset>
          <legend className="mb-1 text-sm">On these days</legend>
          <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map((d) => (
              <label key={d.value} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="weekdays" value={d.value} defaultChecked={d.value >= 1 && d.value <= 5} />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            First session starts
            <input type="time" name="firstStart" defaultValue="09:00" required className={field} />
          </label>
          <label className="text-sm">
            Last session ends by
            <input type="time" name="lastEnd" defaultValue="16:00" required className={field} />
          </label>
          <label className="text-sm">
            Session length (minutes)
            <input type="number" name="durationMinutes" defaultValue={60} min={15} max={240} step={15} required className={field} />
          </label>
        </div>
        <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          Add times
        </button>
      </form>

      <h2 className="mt-8 mb-3 font-medium">Upcoming times</h2>
      {byDay.size === 0 ? (
        <p className="text-sm text-neutral-500">
          No times yet — clients can still send requests, but won&rsquo;t be able to pick a time.
        </p>
      ) : (
        <div className="space-y-4">
          {[...byDay.entries()].map(([key, daySlots]) => (
            <section key={key} className="rounded-lg border border-neutral-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-medium">{formatSlotDate(daySlots[0].startsAt)}</h3>
              <ul className="flex flex-wrap gap-2">
                {daySlots.map((s) => (
                  <li
                    key={s.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                      s.status === 'AVAILABLE' ? 'border-neutral-300' : 'border-amber-300 bg-amber-50'
                    }`}
                  >
                    <span>{formatSlotTime(s.startsAt)}</span>
                    {s.status === 'AVAILABLE' ? (
                      <form action={deleteSlot}>
                        <input type="hidden" name="id" value={s.id} />
                        <button aria-label={`Remove ${formatSlotTime(s.startsAt)}`} className="text-neutral-400 hover:text-red-700">
                          ✕
                        </button>
                      </form>
                    ) : s.booking ? (
                      <Link href={`/admin/bookings/${s.booking.id}`} className="underline underline-offset-2">
                        {s.booking.fullName}
                      </Link>
                    ) : (
                      <span>{s.status.toLowerCase()}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
