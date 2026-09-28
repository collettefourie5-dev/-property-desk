import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { hashEmail, hashPhone } from '@/lib/tracking/hash';

describe('hashEmail', () => {
  it('normalizes case and whitespace before hashing, per Meta requirements', () => {
    expect(hashEmail('  Jane@Example.com  ')).toBe(hashEmail('jane@example.com'));
    expect(hashEmail('jane@example.com')).toBe(
      createHash('sha256').update('jane@example.com').digest('hex'),
    );
  });

  it('never returns the plaintext email', () => {
    expect(hashEmail('jane@example.com')).not.toContain('jane');
  });
});

describe('hashPhone', () => {
  it('strips formatting so equivalent numbers hash the same', () => {
    expect(hashPhone('082 123 4567')).toBe(hashPhone('+27821234567'.replace('+27', '0')));
    expect(hashPhone('(082) 123-4567')).toBe(hashPhone('0821234567'));
  });
});
