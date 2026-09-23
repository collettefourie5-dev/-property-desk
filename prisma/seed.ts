/**
 * Safe, idempotent dev/test seed data. Never run against production (spec section 34) —
 * this script only ever runs via `npm run db:seed`, invoked manually or by local/CI tooling,
 * never from a deploy script.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/db/prisma';
import { createStaffAccount } from '../src/lib/auth/auth';

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
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
