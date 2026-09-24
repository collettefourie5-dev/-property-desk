import type { Metadata } from 'next';
import { ComplianceFooter } from '@/components/marketing/compliance-footer';
import { getSiteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'What to expect',
  robots: { index: false, follow: false },
};

const steps = [
  {
    title: 'Check your email',
    body: 'You will receive a booking confirmation with your session time. If you can’t find it, check your spam folder.',
  },
  {
    title: 'Send us your documents',
    body: 'Before the session, upload your OTP, agreement or any correspondence you have. The more we can read beforehand, the more useful your session will be.',
  },
  {
    title: 'Your session',
    body: 'A private, focused conversation about your transaction: where you stand, what could go wrong, and what to do next.',
  },
  {
    title: 'Your Transaction Roadmap',
    body: 'After the session you receive a written roadmap of the key points and recommended next steps.',
  },
];

export default function WhatToExpectPage() {
  const site = getSiteConfig();
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <h1 className="font-serif text-4xl">What to expect</h1>
        <ol className="mt-8 space-y-6">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <h2 className="font-semibold">{s.title}</h2>
                <p className="mt-1 text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-10 rounded-xl bg-surface p-5 text-sm text-muted">{site.paidConsultationNotice}</p>
      </main>
      <ComplianceFooter />
    </>
  );
}
