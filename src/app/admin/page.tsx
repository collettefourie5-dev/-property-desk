import Link from 'next/link';
import { requireRole } from '@/lib/permissions';
import { prisma } from '@/lib/db/prisma';
import { SignOutButton } from '@/components/admin/sign-out-button';

export default async function AdminDashboardPage() {
  const session = await requireRole('ADMIN');

  const [bookingCount, recentAuditLogs] = await Promise.all([
    prisma.booking.count({ where: { intakeSubmittedAt: { not: null } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">The Property Desk — Admin</h1>
          <p className="text-sm text-neutral-600">
            Signed in as {session.user.name} ({session.user.email})
          </p>
        </div>
        <SignOutButton />
      </div>

      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Booking requests</h2>
        <p className="text-3xl font-semibold">{bookingCount}</p>
        <Link href="/admin/bookings" className="mt-2 inline-block text-sm underline underline-offset-2">
          View all
        </Link>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Recent activity</h2>
        {recentAuditLogs.length === 0 ? (
          <p className="text-sm text-neutral-500">No activity yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentAuditLogs.map((entry) => (
              <li key={entry.id} className="flex justify-between border-b border-neutral-100 pb-2 last:border-0">
                <span>
                  {entry.action}
                  {entry.actor ? ` — ${entry.actor.name}` : ''}
                </span>
                <span className="text-neutral-400">{entry.createdAt.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
