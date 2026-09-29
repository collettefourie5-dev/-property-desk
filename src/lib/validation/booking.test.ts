import { describe, expect, it } from 'vitest';
import { contactSchema, partiesSchema, propertySchema, stageSchema, stepSchemas } from '@/lib/validation/booking';

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
