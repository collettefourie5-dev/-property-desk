import { describe, expect, it } from 'vitest';
import {
  attributionFromParams,
  parseAttributionCookie,
  serializeAttribution,
} from '@/lib/attribution';

describe('attributionFromParams', () => {
  it('maps UTM params and the variant param', () => {
    const result = attributionFromParams(
      new URLSearchParams('utm_source=facebook&utm_campaign=c1&utm_content=ad3&v=price'),
    );
    expect(result).toEqual({
      utmSource: 'facebook',
      utmCampaign: 'c1',
      utmContent: 'ad3',
      variant: 'price',
    });
  });

  it('returns undefined when the URL carries no attribution, so an existing cookie is kept', () => {
    expect(attributionFromParams(new URLSearchParams('foo=bar'))).toBeUndefined();
  });

  it('rejects oversized values rather than storing them', () => {
    expect(attributionFromParams(new URLSearchParams(`utm_source=${'x'.repeat(500)}`))).toBeUndefined();
  });
});

describe('attribution cookie round trip', () => {
  it('serializes and parses back to the same value', () => {
    const original = { utmSource: 'facebook', utmContent: 'ad3' };
    expect(parseAttributionCookie(serializeAttribution(original))).toEqual(original);
  });

  it('treats tampered or malformed cookies as empty', () => {
    expect(parseAttributionCookie('not-json')).toEqual({});
    expect(parseAttributionCookie(undefined)).toEqual({});
    expect(parseAttributionCookie(encodeURIComponent('{"utmSource":123}'))).toEqual({});
  });
});
