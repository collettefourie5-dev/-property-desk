import { prisma } from '@/lib/db/prisma';
import { getSiteConfig } from '@/lib/site-config';

export interface LandingContent {
  slug: string;
  headline: string;
  subheadline: string | null;
  heroImageUrl: string | null;
  priceLabel: string;
  ctaLabel: string;
}

/** Used only if the database has no usable variant at all, so the page can never render blank. */
function hardcodedDefault(): LandingContent {
  return {
    slug: 'default',
    headline: 'Selling property? Get a clear legal strategy before you sign anything.',
    subheadline: 'A focused Pre-Sale Property Strategy Session with a qualified attorney.',
    heroImageUrl: null,
    priceLabel: `${getSiteConfig().priceLabel} once-off`,
    ctaLabel: 'Book your session',
  };
}

/**
 * Picks the headline block that message-matches the ad the visitor clicked: tries each
 * candidate slug (from ?v= then utm_content) against active variants, then the default.
 */
export async function getLandingContent(candidates: (string | undefined)[]): Promise<LandingContent> {
  const slugs = candidates.filter((s): s is string => Boolean(s));

  const variants = await prisma.landingPageVariant.findMany({
    where: { isActive: true, OR: [{ slug: { in: slugs } }, { isDefault: true }] },
  });

  const chosen =
    slugs.map((s) => variants.find((v) => v.slug === s)).find(Boolean) ??
    variants.find((v) => v.isDefault);

  if (!chosen) return hardcodedDefault();

  const fallback = hardcodedDefault();
  return {
    slug: chosen.slug,
    headline: chosen.headline,
    subheadline: chosen.subheadline,
    heroImageUrl: chosen.heroImageUrl,
    priceLabel: chosen.priceLabel ?? fallback.priceLabel,
    ctaLabel: chosen.ctaLabel ?? fallback.ctaLabel,
  };
}
