import type { Metadata } from 'next';
import { ComplianceFooter } from '@/components/marketing/compliance-footer';
import { getSiteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Book your session',
  robots: { index: false, follow: false },
};

/** No site navigation here — the booking flow has one job, and paid traffic shouldn't leak out of it. */
export default function BookLayout({ children }: { children: React.ReactNode }) {
  const site = getSiteConfig();
  return (
    <>
      <div className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
        <p className="mb-6 text-sm font-medium uppercase tracking-widest text-accent">
          {site.name} · {site.sessionName}
        </p>
        {children}
      </div>
      <ComplianceFooter />
    </>
  );
}
