import Link from 'next/link';
import { ComplianceFooter } from '@/components/marketing/compliance-footer';
import { getSiteConfig } from '@/lib/site-config';

/** Shared placeholder for paths whose funnel isn't built yet (Purchaser funnel etc.), so they slot in later without a rebuild. */
export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  const site = getSiteConfig();
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">The Property Desk</p>
        <h1 className="mt-3 font-serif text-4xl">{title}</h1>
        <p className="mt-4 text-lg text-muted">{blurb}</p>
        <p className="mt-6">
          This page is being prepared. If your matter is time-sensitive, contact us directly at{' '}
          <strong>{site.contactEmail}</strong>.
        </p>
        <Link href="/" className="mt-8 inline-block underline underline-offset-2">
          &larr; Back
        </Link>
      </main>
      <ComplianceFooter />
    </>
  );
}
