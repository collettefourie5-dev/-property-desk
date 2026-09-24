import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/permissions';
import { STAGES } from '@/lib/validation/booking';

const PAGE_SIZE = 25;

export default async function AdminBookingsPage(props: PageProps<'/admin/bookings'>) {
  await requireRole('ADMIN');
  const raw = (await props.searchParams).page;
  const page = Math.max(1, Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? '1'), 10) || 1);

  // Only submitted requests — abandoned drafts are not bookings.
  const where = { intakeSubmittedAt: { not: null } };
  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { intakeSubmittedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        fullName: true,
        email: true,
        stage: true,
        paymentStatus: true,
        adminNotifiedAt: true,
        intakeSubmittedAt: true,
        _count: { select: { documents: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/admin" className="text-sm underline underline-offset-2">
        &larr; Admin
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Booking requests ({total})</h1>

      {bookings.length === 0 ? (
        <p className="text-neutral-600">No booking requests yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Docs</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Emailed</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {b.intakeSubmittedAt?.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${b.id}`} className="font-medium underline underline-offset-2">
                      {b.fullName}
                    </Link>
                    <div className="text-neutral-500">{b.email}</div>
                  </td>
                  <td className="px-4 py-3">{STAGES.find((s) => s.value === b.stage)?.label}</td>
                  <td className="px-4 py-3">{b._count.documents}</td>
                  <td className="px-4 py-3">{b.paymentStatus}</td>
                  <td className="px-4 py-3">
                    {b.adminNotifiedAt ? 'Yes' : <span className="font-medium text-red-700">Not sent</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center gap-4 text-sm" aria-label="Pagination">
          {page > 1 && <Link href={`/admin/bookings?page=${page - 1}`}>&larr; Newer</Link>}
          <span className="text-neutral-500">
            Page {page} of {pages}
          </span>
          {page < pages && <Link href={`/admin/bookings?page=${page + 1}`}>Older &rarr;</Link>}
        </nav>
      )}
    </main>
  );
}
