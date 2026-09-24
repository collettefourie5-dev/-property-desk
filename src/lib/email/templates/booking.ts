import { escapeHtml, singleLine } from '@/lib/email/escape';
import { OWNERSHIPS, STAGES } from '@/lib/validation/booking';

/** The subset of a booking these emails need — kept structural so templates are trivially testable. */
export interface BookingEmailData {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  propertyAddress: string | null;
  propertyType: string | null;
  stage: string | null;
  ownershipStructure: string | null;
  otherParties: string | null;
  transactionSummary: string | null;
  mainConcern: string | null;
  desiredOutcome: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  landingPageVariantSlug: string | null;
  createdAt: Date;
  documents: { originalName: string; sizeBytes: number }[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');

export function bookingDetailRows(b: BookingEmailData): [string, string][] {
  const stage = STAGES.find((s) => s.value === b.stage)?.label ?? dash(b.stage);
  const ownership = OWNERSHIPS.find((o) => o.value === b.ownershipStructure)?.label ?? dash(b.ownershipStructure);
  const docs = b.documents.length
    ? b.documents.map((d) => `${d.originalName} (${Math.max(1, Math.round(d.sizeBytes / 1024))} KB)`).join(', ')
    : 'None uploaded';

  return [
    ['Name', dash(b.fullName)],
    ['Email', dash(b.email)],
    ['Mobile', dash(b.phone)],
    ['Property', `${dash(b.propertyAddress)} (${dash(b.propertyType)})`],
    ['Stage', stage],
    ['Ownership', ownership],
    ['Other parties', dash(b.otherParties)],
    ['The transaction', dash(b.transactionSummary)],
    ['Main concern', dash(b.mainConcern)],
    ['Goal for the session', dash(b.desiredOutcome)],
    ['Documents', docs],
  ];
}

/** The email that lands in the attorney's inbox for every new booking request. */
export function bookingRequestEmail(b: BookingEmailData, opts: { adminUrl: string }): RenderedEmail {
  const details = bookingDetailRows(b);
  const source = [b.utmSource, b.utmCampaign, b.utmContent, b.landingPageVariantSlug]
    .filter(Boolean)
    .join(' / ');

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:640px;color:#1a1a1a">
<h2 style="margin:0 0 4px">New booking request</h2>
<p style="margin:0 0 20px;color:#5c6663">Pre-Sale Property Strategy Session · R1,250 · received ${escapeHtml(b.createdAt.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }))}</p>
<table style="border-collapse:collapse;width:100%">
${details
  .map(
    ([label, value]) =>
      `<tr><td style="padding:8px 12px 8px 0;vertical-align:top;color:#5c6663;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
  )
  .join('\n')}
</table>
${source ? `<p style="margin:20px 0 0;color:#5c6663;font-size:13px">Came from: ${escapeHtml(source)}</p>` : ''}
<p style="margin:24px 0 0"><a href="${escapeHtml(opts.adminUrl)}" style="background:#1f3a34;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">Open booking &amp; documents</a></p>
<p style="margin:16px 0 0;color:#5c6663;font-size:13px">Reply to this email to reach ${escapeHtml(dash(b.fullName))} directly.</p>
</div>`;

  const text = [
    'NEW BOOKING REQUEST',
    'Pre-Sale Property Strategy Session · R1,250',
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    source ? `\nCame from: ${source}` : '',
    '',
    `Open booking & documents: ${opts.adminUrl}`,
    'Reply to this email to reach the client directly.',
  ].join('\n');

  return { subject: `New booking request — ${singleLine(b.fullName ?? 'unknown')}`, html, text };
}

/** A short receipt so the client knows the request went through. Deliberately makes no promises about timing or payment. */
export function clientAcknowledgementEmail(
  b: Pick<BookingEmailData, 'fullName'>,
  opts: { attorneyName: string; whatToExpectUrl: string },
): RenderedEmail {
  const name = escapeHtml(singleLine(b.fullName ?? 'there', 60));
  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;color:#1a1a1a">
<h2 style="margin:0 0 12px">We have your booking request</h2>
<p>Hi ${name},</p>
<p>Thank you — we have received your request for a Pre-Sale Property Strategy Session and ${escapeHtml(opts.attorneyName)} will be in touch with you shortly to arrange it.</p>
<p><a href="${escapeHtml(opts.whatToExpectUrl)}">What to expect</a></p>
<p style="color:#5c6663;font-size:13px">This is a paid consultation and not an instruction to act on your transaction.</p>
</div>`;
  const text = `Hi ${singleLine(b.fullName ?? 'there', 60)},

Thank you — we have received your request for a Pre-Sale Property Strategy Session and ${opts.attorneyName} will be in touch with you shortly to arrange it.

What to expect: ${opts.whatToExpectUrl}

This is a paid consultation and not an instruction to act on your transaction.`;
  return { subject: 'We have your booking request — The Property Desk', html, text };
}
