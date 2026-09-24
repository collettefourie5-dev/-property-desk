/**
 * Safe, idempotent dev/test seed data. Never run against production (spec section 34) —
 * this script only ever runs via `npm run db:seed`, invoked manually or by local/CI tooling,
 * never from a deploy script.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/db/prisma';
import { createStaffAccount } from '../src/lib/auth/auth';
import { createSlots } from '../src/server/services/availability';
import { sastDateKey } from '../src/lib/time';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed admin already exists: ${email}`);
  } else {
    await createStaffAccount({
      name: 'Collette Fourie',
      email,
      password,
      role: 'ADMIN',
    });
    console.log(`Created seed admin: ${email} (change this password after first login)`);
  }

  const defaultVariantSlug = 'default';
  await prisma.landingPageVariant.upsert({
    where: { slug: defaultVariantSlug },
    update: {},
    create: {
      slug: defaultVariantSlug,
      headline: 'Selling property? Get a clear legal strategy before you sign anything.',
      subheadline: 'A focused Pre-Sale Property Strategy Session with a qualified attorney.',
      priceLabel: 'R1,250 once-off',
      ctaLabel: 'Book your session',
      isActive: true,
      isDefault: true,
    },
  });
  console.log('Ensured default landing page variant exists');

  // Sample calendar for local testing: weekdays 09:00-16:00, hourly, for the next two weeks.
  const end = new Date();
  end.setDate(end.getDate() + 14);
  const { created, skipped } = await createSlots({
    startDate: sastDateKey(new Date()),
    endDate: sastDateKey(end),
    weekdays: [1, 2, 3, 4, 5],
    firstStart: '09:00',
    lastEnd: '16:00',
    durationMinutes: 60,
  });
  console.log(`Sample calendar: ${created} slots added, ${skipped} already existed`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
