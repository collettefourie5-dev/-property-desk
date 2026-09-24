import type { Metadata } from 'next';
import Link from 'next/link';
import { ComplianceFooter } from '@/components/marketing/compliance-footer';
import { Testimonials } from '@/components/marketing/testimonials';
import { getLandingContent } from '@/server/services/landing';
import { getSiteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Selling property? Pre-Sale Property Strategy Session',
  description:
    'A private strategy session with an admitted attorney before you sign an offer to purchase.',
};

const included = [
  'A private one-on-one session with an admitted attorney',
  'Your OTP, agreement or correspondence reviewed beforehand',
  'A clear view of your risks, options and sensible next steps',
  'A written Transaction Roadmap sent to you afterwards',
];

const steps = [
  'Tell us about the property and where the deal is at',
  'Send your booking request — choose a time and your language (English or Afrikaans)',
  'We personally confirm your session and take you through pricing',
];

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SellingPage(props: PageProps<'/selling'>) {
  const search = await props.searchParams;
  // ?v= is an explicit variant choice; utm_content lets each ad's own tag select its headline.
  const content = await getLandingContent([firstValue(search.v), firstValue(search.utm_content)]);
  const site = getSiteConfig();

  // No site navigation on this page on purpose: paid traffic has one job to do here.
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:py-16">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">{site.sessionName}</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-5xl">{content.headline}</h1>
        {content.subheadline && <p className="mt-4 text-lg text-muted">{content.subheadline}</p>}

        <div className="mt-8 rounded-2xl border border-black/10 bg-surface p-6">
          <p className="text-3xl font-semibold">{content.priceLabel}</p>
          <p className="mt-1 text-sm text-muted">Paid consultation — not an instruction to act on your transaction.</p>
          <Link
            href="/book"
            className="mt-5 flex w-full items-center justify-center rounded-lg bg-brand px-6 py-4 text-lg font-semibold text-white hover:bg-brand-hover"
          >
            {content.ctaLabel}
          </Link>
        </div>

        <section aria-labelledby="included-heading" className="mt-12">
          <h2 id="included-heading" className="font-serif text-2xl">
            What&rsquo;s included
          </h2>
          <ul className="mt-4 space-y-3">
            {included.map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden className="mt-1 text-accent">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how-heading" className="mt-12">
          <h2 id="how-heading" className="font-serif text-2xl">
            How it works
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        <Testimonials />
      </main>
      <ComplianceFooter />
    </>
  );
}
