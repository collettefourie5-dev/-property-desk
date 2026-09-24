import { describe, expect, it } from 'vitest';
import { escapeHtml, singleLine } from '@/lib/email/escape';
import {
  bookingRequestEmail,
  clientAcknowledgementEmail,
  type BookingEmailData,
} from '@/lib/email/templates/booking';

const booking: BookingEmailData = {
  id: 'b1',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '0821234567',
  propertyAddress: '12 Test Street, Sea Point',
  propertyType: 'House',
  stage: 'HAVE_OTP',
  ownershipStructure: 'JOINT',
  otherParties: 'Spouse',
  transactionSummary: 'Buyer offered R2m',
  mainConcern: 'Penalty clause',
  desiredOutcome: 'Exit safely',
  utmSource: 'facebook',
  utmCampaign: 'c1',
  utmContent: 'ad3',
  landingPageVariantSlug: 'price',
  createdAt: new Date('2026-09-24T08:00:00Z'),
  documents: [{ originalName: 'OTP.pdf', sizeBytes: 20480 }],
};

describe('bookingRequestEmail', () => {
  const mail = bookingRequestEmail(booking, { adminUrl: 'https://desk.example/admin/bookings/b1' });

  it('contains every detail the attorney needs, in readable form', () => {
    for (const expected of [
      'Jane Doe',
      'jane@example.com',
      '0821234567',
      '12 Test Street, Sea Point',
      'I have an OTP / offer',
      'Joint owners',
      'Penalty clause',
      'Exit safely',
      'OTP.pdf',
      'facebook / c1 / ad3 / price',
      'https://desk.example/admin/bookings/b1',
    ]) {
      expect(mail.text).toContain(expected);
    }
    expect(mail.subject).toBe('New booking request — Jane Doe');
  });

  it('escapes client-typed HTML so it cannot inject markup or links into the inbox', () => {
    const hostile = bookingRequestEmail(
      {
        ...booking,
        fullName: '<img src=x onerror=alert(1)>',
        transactionSummary: '<a href="https://evil.example">click</a> & "quotes"',
      },
      { adminUrl: 'https://desk.example/admin/bookings/b1' },
    );
    expect(hostile.html).not.toContain('<img');
    expect(hostile.html).not.toContain('<a href="https://evil.example"');
    expect(hostile.html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;');
  });

  it('cannot be used for header injection through the subject', () => {
    const hostile = bookingRequestEmail(
      { ...booking, fullName: 'Jane\r\nBcc: attacker@evil.example' },
      { adminUrl: 'https://desk.example/x' },
    );
    expect(hostile.subject).not.toMatch(/[\r\n]/);
  });
});

describe('clientAcknowledgementEmail', () => {
  it('thanks the client without promising a time or mentioning payment mechanics', () => {
    const mail = clientAcknowledgementEmail(booking, {
      attorneyName: 'Collette Fourie',
      whatToExpectUrl: 'https://desk.example/what-to-expect',
    });
    expect(mail.text).toContain('Hi Jane Doe');
    expect(mail.text).toContain('Collette Fourie');
    expect(mail.text.toLowerCase()).not.toContain('payfast');
  });
});

describe('escape helpers', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
  it('collapses control characters and bounds length', () => {
    expect(singleLine('a\r\nb\tc')).toBe('a b c');
    expect(singleLine('x'.repeat(500))).toHaveLength(120);
  });
});
