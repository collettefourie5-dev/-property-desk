import Link from 'next/link';
import { getSiteConfig } from '@/lib/site-config';

/** Compliance details required on every public page: LPC admission + paid-consultation notice + POPIA link. */
export function ComplianceFooter() {
  const site = getSiteConfig();
  return (
    <footer className="mt-auto border-t border-black/10 bg-surface px-5 py-8 text-sm text-muted">
      <div className="mx-auto max-w-3xl space-y-3">
        <p>
          <strong className="text-foreground">{site.attorneyName}</strong> — {site.lpcAdmission}
        </p>
        <p>{site.firmName}</p>
        <p>{site.paidConsultationNotice}</p>
        <p>
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy notice (POPIA)
          </Link>
          {' · '}
          {site.contactEmail}
        </p>
      </div>
    </footer>
  );
}
