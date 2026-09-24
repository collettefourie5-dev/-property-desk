import { describe, expect, it } from 'vitest';
import {
  contactSchema,
  partiesSchema,
  propertySchema,
  safeDisplayName,
  sniffDocumentType,
  stageSchema,
  stepSchemas,
} from '@/lib/validation/booking';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(32).fill(0)]);

describe('contactSchema', () => {
  const valid = { fullName: 'Jane Doe', email: 'jane@example.com', phone: '+27 82 123 4567', consent: 'on' };

  it('accepts valid contact details', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it('requires POPIA consent', () => {
    expect(contactSchema.safeParse({ ...valid, consent: undefined }).success).toBe(false);
  });

  it.each(['abc', '12', '<script>alert(1)</script>'])('rejects bad phone %s', (phone) => {
    expect(contactSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
  });
});

describe('step schemas', () => {
  it('only accepts known property types and stages', () => {
    expect(propertySchema.safeParse({ propertyAddress: '1 Main Rd', propertyType: 'Castle' }).success).toBe(false);
    expect(stageSchema.safeParse({ stage: 'HAVE_OTP' }).success).toBe(true);
    expect(stageSchema.safeParse({ stage: 'PAID' }).success).toBe(false);
  });

  it('requires other parties to be filled in ("None" is fine)', () => {
    expect(partiesSchema.safeParse({ otherParties: '  ' }).success).toBe(false);
    expect(partiesSchema.safeParse({ otherParties: 'None' }).success).toBe(true);
  });

  it('strips unknown fields so a browser cannot smuggle in paymentStatus or amount', () => {
    const parsed = stepSchemas.intent.parse({
      desiredOutcome: 'Sell safely',
      paymentStatus: 'PAID',
      amount: '0',
    });
    expect(parsed).toEqual({ desiredOutcome: 'Sell safely' });
  });
});

describe('sniffDocumentType', () => {
  it('recognises allowed types by content', () => {
    expect(sniffDocumentType(bytes(0x25, 0x50, 0x44, 0x46))).toBe('application/pdf');
    expect(sniffDocumentType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffDocumentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffDocumentType(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBe('application/msword');
  });

  it('accepts a docx (zip with Word parts) but rejects an arbitrary zip', () => {
    const docx = new TextEncoder().encode('PK\u0003\u0004....[Content_Types].xml....word/document.xml');
    const zip = new TextEncoder().encode('PK\u0003\u0004....some-other-file.txt');
    expect(sniffDocumentType(docx)).toContain('wordprocessingml');
    expect(sniffDocumentType(zip)).toBeNull();
  });

  it('rejects executables and scripts regardless of what they are called', () => {
    expect(sniffDocumentType(new TextEncoder().encode('MZ\u0090\u0000 windows exe'))).toBeNull();
    expect(sniffDocumentType(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull();
    expect(sniffDocumentType(new TextEncoder().encode('#!/bin/sh\nrm -rf /'))).toBeNull();
  });
});

describe('safeDisplayName', () => {
  it('strips path components and control characters', () => {
    expect(safeDisplayName('..\\..\\etc/passwd')).toBe('passwd');
    expect(safeDisplayName('offer\u0000.pdf')).toBe('offer.pdf');
    expect(safeDisplayName('   ')).toBe('document');
    expect(safeDisplayName('a'.repeat(400))).toHaveLength(150);
  });
});
