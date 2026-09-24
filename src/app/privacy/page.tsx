import type { Metadata } from 'next';
import { ComplianceFooter } from '@/components/marketing/compliance-footer';
import { getSiteConfig } from '@/lib/site-config';

export const metadata: Metadata = { title: 'Privacy notice (POPIA)' };

/**
 * DRAFT privacy notice covering what this site actually collects. It must be reviewed and
 * approved by the responsible attorney/Information Officer before launch — it is a starting
 * point, not legal advice, and the bracketed items are placeholders.
 */
export default function PrivacyPage() {
  const site = getSiteConfig();
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-5 py-12 leading-relaxed">
        <h1 className="font-serif text-4xl">Privacy notice</h1>
        <p className="text-muted">
          How {site.firmName} (&ldquo;we&rdquo;) processes your personal information under the Protection of
          Personal Information Act 4 of 2013 (POPIA).
        </p>

        <section>
          <h2 className="font-serif text-2xl">What we collect</h2>
          <p className="mt-2">
            When you book a session: your name, email address and phone number; the property address and
            type; details of the transaction, including its stage, the ownership structure and other parties
            involved; anything you write to us about the transaction; and any documents you upload (for
            example an offer to purchase, agreement or correspondence). Documents may contain the personal
            information of other people; only upload what is relevant.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl">Why we collect it</h2>
          <p className="mt-2">
            To take your booking, prepare for and hold your consultation, deliver your written roadmap,
            process your payment, comply with our legal and professional obligations, and communicate with
            you about your booking.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl">Payment</h2>
          <p className="mt-2">
            Payments are processed by PayFast. We do not see or store your card details; we receive only
            confirmation of the payment.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl">Advertising and analytics</h2>
          <p className="mt-2">
            We use the Meta (Facebook) Pixel and Conversions API to measure which advertisements lead to
            bookings. This shares limited information about your interaction with the site (for example that
            a booking was made) with Meta. We do not send the contents of your documents or your written
            description of the transaction.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl">Confidentiality, sharing and storage</h2>
          <p className="mt-2">
            Information you give us in connection with legal advice is treated as confidential. We share it
            only with service providers who help us run the service (hosting, email, payment) under
            appropriate safeguards, or where the law requires. We keep it for as long as needed for the
            purposes above and any legal retention period: [retention period to be confirmed].
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl">Your rights</h2>
          <p className="mt-2">
            You may ask us to confirm what we hold about you, to correct it, or to delete it where we are
            permitted to. Contact our Information Officer: [name to be added], {site.contactEmail}. You may
            also complain to the Information Regulator (inforegulator.org.za).
          </p>
        </section>
      </main>
      <ComplianceFooter />
    </>
  );
}
