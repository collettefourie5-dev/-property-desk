/**
 * Single source of truth for business facts shown on the site. Read from plain runtime env
 * vars, never NEXT_PUBLIC_*: those are frozen into the bundle at build time, and our Docker
 * image is built with no environment by design.
 */
export function getSiteConfig() {
  return {
    name: 'The Property Desk',
    sessionName: 'Pre-Sale Property Strategy Session',
    priceZar: 1250,
    priceLabel: 'R1,250',
    attorneyName: process.env.ATTORNEY_NAME ?? 'Collette Fourie',
    firmName: process.env.FIRM_NAME ?? 'Crawford Harris Inc.',
    contactEmail: process.env.CONTACT_EMAIL ?? '[contact email to be added]',
    paidConsultationNotice:
      'This is a paid, once-off consultation. It is not an instruction to act on your transaction and does not include drafting, negotiating or attending to any part of it. Any further work is agreed separately, in writing.',
  };
}
